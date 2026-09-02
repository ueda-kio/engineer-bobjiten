/**
 * What the client makes of what the server says.
 *
 * Pure and free of React, WebSocket and storage: the hook that owns those calls
 * these three functions and does nothing else of consequence.
 */

import type { JoinRejection } from "../domain/connection";
import type { Payload } from "../domain/payload";
import type { DeniedOperation, JoinedMessage, ServerMessage } from "./protocol";

/** Doubles from here... */
const FIRST_RECONNECT_DELAY_MS = 1000;
/** ...up to this, then holds. */
const MAX_RECONNECT_DELAY_MS = 30_000;

/**
 * Enough attempts to keep trying for about half an hour: 1+2+4+8+16 seconds,
 * then 30 seconds apiece.
 *
 * Long on purpose. The auto-skip in design 6.5 gives up on an absent presenter
 * after three minutes, but the seat and its token live as long as the room does
 * — a day, per 6.7 — so somebody who steps out for a smoke or walks to the
 * second venue can still come back to their score. A client that stopped trying
 * after a few minutes would be throwing that way back away by itself, and it
 * costs seven phones nothing to keep knocking every thirty seconds.
 */
const MAX_RECONNECT_ATTEMPTS = 65;

/** How long to wait before attempt number `attempt`, or null to stop trying. */
export const reconnectDelay = (attempt: number): number | null =>
  attempt >= MAX_RECONNECT_ATTEMPTS
    ? null
    : Math.min(FIRST_RECONNECT_DELAY_MS * 2 ** attempt, MAX_RECONNECT_DELAY_MS);

export type ConnectionStatus =
  | { kind: "connecting" }
  /** The socket is open and `join` has gone out. */
  | { kind: "joining" }
  | { kind: "joined"; playerId: string }
  /** Several seats are free and one must be picked (design 6.4). */
  | { kind: "choosingSeat" }
  | { kind: "rejected"; reason: JoinRejection }
  | { kind: "reconnecting"; attempt: number }
  /**
   * Stopped trying. `rejoinable` says a seat was held here, so the way back is
   * still open and the screen should say so rather than blame the connection.
   */
  | { kind: "gaveUp"; rejoinable: boolean };

export type Notice =
  | { kind: "denied"; operation: DeniedOperation }
  | { kind: "error"; message: string };

export type ClientConnectionState = {
  status: ConnectionStatus;
  /** The last snapshot. Survives denials and disconnects so the screen holds. */
  payload: Payload | null;
  notice: Notice | null;
  /** True once a join has succeeded here: the seat outlives the socket. */
  seated: boolean;
};

export type ConnectionEvent =
  | { type: "opened" }
  | { type: "received"; message: ServerMessage }
  | { type: "disconnected" }
  /** Asked for by the person: retrying after giving up, or claiming a seat. */
  | { type: "reconnect" };

export const createConnectionState = (): ClientConnectionState => ({
  status: { kind: "connecting" },
  payload: null,
  notice: null,
  seated: false,
});

export const reduceConnection = (
  state: ClientConnectionState,
  event: ConnectionEvent,
): ClientConnectionState => {
  switch (event.type) {
    case "opened":
      return { ...state, status: { kind: "joining" }, notice: null };

    case "reconnect":
      return { ...state, status: { kind: "connecting" }, notice: null };

    case "disconnected":
      // The server closes the socket after refusing a join, so retrying on our
      // own would just bounce between refusal and reconnect for as long as the
      // room lives. These states wait for the person instead.
      return isSettled(state.status)
        ? state
        : { ...state, status: awayStatus(nextAttempt(state.status), state.seated) };

    case "received":
      return receive(state, event.message);
  }
};

/**
 * The token to keep for this room.
 *
 * A `resumed` reply carries none, because the client already holds the one it
 * proved itself with. Returning what was stored is what stops that reply from
 * clearing it — losing it would leave the player unable to reach their own seat
 * until the host released it (design 6.4).
 */
export const nextStoredToken = (stored: string | null, message: JoinedMessage): string | null =>
  message.outcome === "resumed" ? stored : message.token;

const receive = (state: ClientConnectionState, message: ServerMessage): ClientConnectionState => {
  switch (message.type) {
    case "joined":
      return {
        status: { kind: "joined", playerId: message.playerId },
        payload: message.payload,
        notice: null,
        seated: true,
      };

    case "state":
      // Stored as it arrives, tokens included — except there are none. The
      // payload is built from the roster alone, and `src/domain/payload.test.ts`
      // serialises both kinds to prove no token appears in either. This client's
      // own token lives in storage, by way of `nextStoredToken`; nothing here
      // will ever hold anybody else's.
      return { ...state, payload: message.payload };

    case "rejected":
      return {
        ...state,
        status:
          message.reason === "seatAmbiguous"
            ? { kind: "choosingSeat" }
            : { kind: "rejected", reason: message.reason },
      };

    case "denied":
      return { ...state, notice: { kind: "denied", operation: message.operation } };

    case "error":
      return { ...state, notice: { kind: "error", message: message.message } };
  }
};

/** States that only the person can move on from. */
const isSettled = (status: ConnectionStatus): boolean =>
  status.kind === "rejected" || status.kind === "choosingSeat" || status.kind === "gaveUp";

const nextAttempt = (status: ConnectionStatus): number =>
  status.kind === "reconnecting" ? status.attempt + 1 : 0;

const awayStatus = (attempt: number, seated: boolean): ConnectionStatus =>
  reconnectDelay(attempt) === null
    ? { kind: "gaveUp", rejoinable: seated }
    : { kind: "reconnecting", attempt };
