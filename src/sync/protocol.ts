/**
 * The messages exchanged between a client and the room's Durable Object.
 *
 * Types only, so both sides can import it. The wire format is JSON, and every
 * server message carries a whole snapshot rather than a diff (tech selection
 * 5.3), which makes a reconnect just another delivery.
 */

import type { JoinRejection } from "../domain/connection";
import type { Payload } from "../domain/payload";
import type { SessionAction } from "../domain/session";

export type ClientMessage =
  /** Entering the room. `token` proves a returning player; `name` names a new one. */
  | { type: "join"; name: string; token?: string; claimPlayerId?: string }
  /** A game operation. `addPlayer` is refused: registration goes through `join`. */
  | { type: "action"; action: SessionAction }
  /** Host-only, and not a `SessionAction`: the seat lives in the sync layer. */
  | { type: "releaseSeat"; playerId: string };

/** What a `denied` message reports. `releaseSeat` is not a `SessionAction`. */
export type DeniedOperation = SessionAction["type"] | "releaseSeat";

/**
 * The reply to `join`, split the same way `authorizeJoin` splits its outcome.
 *
 * `token` is required where one was issued and absent where none was, rather
 * than optional throughout: a client that stored an optional `token` without
 * checking would overwrite its working token with `undefined` on every resume,
 * and the player could then only get back in by having the host free the seat.
 */
export type JoinedMessage =
  /** Identified by the token the client already holds. No new one is issued. */
  | { type: "joined"; outcome: "resumed"; playerId: string; payload: Payload }
  /** Took over a released seat, so the seat's score comes with it. */
  | { type: "joined"; outcome: "reseated"; playerId: string; token: string; payload: Payload }
  | { type: "joined"; outcome: "created"; playerId: string; token: string; payload: Payload };

export type ServerMessage =
  | JoinedMessage
  | { type: "rejected"; reason: JoinRejection }
  /** A fresh snapshot, addressed to one recipient (design 7.2). */
  | { type: "state"; payload: Payload }
  /**
   * The operation was refused by `canPerform` or `canReleaseSeat`.
   *
   * Note what this does NOT cover: `reduceSession` answers an operation the
   * current phase does not define by returning the same state, so a permitted
   * operation that changes nothing arrives as an ordinary `state` message. From
   * the client's side "I pressed it and nothing happened" therefore has two
   * causes, and only one of them is reported here.
   */
  | { type: "denied"; operation: DeniedOperation }
  /** The frame could not be read as a `ClientMessage`. */
  | { type: "error"; message: string };
