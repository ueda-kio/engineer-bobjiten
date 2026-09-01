/**
 * Connections and identity for the synced version (design 6.1-6.4).
 *
 * Deliberately kept out of `SessionState`: who is connected changes constantly
 * and is not part of the game. The two are linked by `playerId` only, so the
 * state machine and its tests stay free of transport concerns.
 */

/**
 * One player's place in the room. A seat is in exactly one of three states:
 *
 * | 状態   | `token` | `connectionId` |
 * | ------ | ------- | -------------- |
 * | 接続中 | あり    | あり           |
 * | 離脱中 | あり    | null           |
 * | 空席   | null    | null           |
 *
 * The score lives in `SessionState` under `playerId`, so a released seat keeps
 * its points and present count for whoever takes it over (design 6.4).
 */
export type Seat = {
  playerId: string;
  /** The player's secret. Null once the host has released the seat. */
  token: string | null;
  /** The live connection, or null while the player is away. */
  connectionId: string | null;
};

export type ConnectionRegistry = {
  seats: Seat[];
};

export type JoinRequest = {
  connectionId: string;
  /** Proves who the player is. Absent when the client holds no token. */
  token?: string;
  /**
   * Which empty seat to take when no valid token is presented. Without it a
   * returning player would inherit whichever seat happens to come first, and
   * with several seats released at once that is somebody else's score.
   */
  claimPlayerId?: string;
};

export type JoinDeps = {
  /** False once the game has started: new players may no longer register (design 5.6). */
  acceptsNewPlayers: boolean;
  /**
   * Source of unguessable strings for player ids and tokens.
   * Production passes `crypto.randomUUID`; `Rng` is not used, since its `[0, 1)`
   * contract cannot carry a secret.
   */
  newId: () => string;
};

export type JoinRejection =
  /** The claimed seat is taken, still holds a token, or does not exist. */
  | "seatUnavailable"
  /** Nobody new may join and there was no seat to return to. */
  | "newPlayersNotAccepted";

export type JoinOutcome =
  /** Identified by token. Keeps its token; `displaced` is the connection to close. */
  | { kind: "resumed"; registry: ConnectionRegistry; playerId: string; displaced: string | null }
  /** Took over a released seat. Already on the roster, so no `addPlayer` is needed. */
  | { kind: "reseated"; registry: ConnectionRegistry; playerId: string; token: string }
  /** A brand new seat. The caller must still dispatch `addPlayer`. */
  | { kind: "created"; registry: ConnectionRegistry; playerId: string; token: string }
  | { kind: "rejected"; reason: JoinRejection };

export const createRegistry = (): ConnectionRegistry => ({ seats: [] });

/**
 * Decides who is joining and on what terms (design 6.3).
 *
 * Assumes one join per connection: the caller must not reuse a `connectionId`
 * that is already seated.
 */
export const authorizeJoin = (
  registry: ConnectionRegistry,
  request: JoinRequest,
  deps: JoinDeps,
): JoinOutcome => {
  const held = request.token
    ? registry.seats.find((seat) => seat.token === request.token)
    : undefined;

  // A valid token identifies the player outright, whether or not the game has
  // started. The second connection wins so a phone that went to sleep holding a
  // dead socket cannot lock its owner out.
  if (held) {
    return {
      kind: "resumed",
      registry: replaceSeat(registry, { ...held, connectionId: request.connectionId }),
      playerId: held.playerId,
      displaced: held.connectionId,
    };
  }

  // An unknown token counts as no token (design 6.3). Rejecting it would lock
  // out exactly the player whose seat was released: their client still holds
  // the token that release invalidated.
  if (request.claimPlayerId !== undefined) {
    const claimed = registry.seats.find((seat) => seat.playerId === request.claimPlayerId);
    // Only a released seat may be claimed by name. Letting a name claim a seat
    // that still holds a token is the impersonation 6.2 exists to prevent.
    if (!claimed || !isVacant(claimed)) return { kind: "rejected", reason: "seatUnavailable" };
    return reseat(registry, claimed, request.connectionId, deps);
  }

  // Taking over a released seat is not a mid-game join: the player id is already
  // on the roster, so 5.6 does not apply and this stays allowed after start.
  const vacant = registry.seats.find(isVacant);
  if (vacant) return reseat(registry, vacant, request.connectionId, deps);

  if (!deps.acceptsNewPlayers) return { kind: "rejected", reason: "newPlayersNotAccepted" };

  const playerId = deps.newId();
  const token = deps.newId();
  return {
    kind: "created",
    registry: {
      seats: [...registry.seats, { playerId, token, connectionId: request.connectionId }],
    },
    playerId,
    token,
  };
};

export type SeatRelease = {
  registry: ConnectionRegistry;
  /** The connection to close, if the player was still connected. */
  displaced: string | null;
};

/**
 * Frees a seat for a player who can no longer reach their token (design 6.4).
 *
 * The seat is emptied, not removed: keeping `playerId` keeps the score, the
 * present count and the turn order intact. Host-only, but the check lives in
 * `canReleaseSeat` so that every permission rule stays in one file.
 */
export const releaseSeat = (registry: ConnectionRegistry, playerId: string): SeatRelease => {
  const seat = registry.seats.find((current) => current.playerId === playerId);
  if (!seat || isVacant(seat)) return { registry, displaced: null };

  return {
    registry: replaceSeat(registry, { ...seat, token: null, connectionId: null }),
    displaced: seat.connectionId,
  };
};

/**
 * Marks whoever was on `connectionId` as away, keeping the token so they can
 * come back with it.
 *
 * Matching on the connection rather than the player is what makes a late close
 * event harmless: once a reconnect has replaced the connection, the old id is
 * on no seat and the live one survives.
 */
export const disconnect = (
  registry: ConnectionRegistry,
  connectionId: string,
): ConnectionRegistry => ({
  seats: registry.seats.map((seat) =>
    seat.connectionId === connectionId ? { ...seat, connectionId: null } : seat,
  ),
});

/** A seat the host released. Its player id, and so its score, stay behind. */
const isVacant = (seat: Seat): boolean => seat.token === null;

const reseat = (
  registry: ConnectionRegistry,
  seat: Seat,
  connectionId: string,
  deps: JoinDeps,
): JoinOutcome => {
  const token = deps.newId();
  return {
    kind: "reseated",
    registry: replaceSeat(registry, { ...seat, token, connectionId }),
    playerId: seat.playerId,
    token,
  };
};

const replaceSeat = (registry: ConnectionRegistry, seat: Seat): ConnectionRegistry => ({
  seats: registry.seats.map((current) => (current.playerId === seat.playerId ? seat : current)),
});
