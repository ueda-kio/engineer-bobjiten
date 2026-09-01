/**
 * What each connection is sent (design 7.2).
 *
 * This is where the game state and the connection registry first meet: the
 * views decide what an audience may see, the registry knows who is actually
 * there. Kept out of `view.ts` so that deciding the public range stays free of
 * connection concerns.
 */

import { isVacantSeat, type ConnectionRegistry } from "./connection";
import { presenterOf, type SessionState } from "./session";
import {
  toPresenterView,
  toPublicView,
  type PresenterSessionState,
  type PublicSessionState,
} from "./view";

/**
 * Who is not at the table, split by why (design 6.5).
 *
 * The two are separate because the screen says different things: an away player
 * is one everybody is waiting for, while a vacant seat is one the host freed for
 * somebody to sit down in. Merging them would put "waiting to reconnect" on a
 * seat the host deliberately released.
 */
type Presence = {
  /** Registered players with no live connection. They still hold their token. */
  awayPlayerIds: string[];
  /** Seats the host released. The score stays until somebody claims them. */
  vacantPlayerIds: string[];
};

/** Everything design 7.2 grants to everyone. Never carries a token. */
export type PublicPayload = PublicSessionState & Presence & { audience: "everyone" };

/** The public payload plus the round's secrets: the candidates and the topic. */
export type PresenterPayload = PresenterSessionState & Presence & { audience: "presenter" };

export type Payload = PublicPayload | PresenterPayload;

export const toPublicPayload = (
  state: SessionState,
  registry: ConnectionRegistry,
): PublicPayload => ({
  ...toPublicView(state),
  ...presenceOf(state, registry),
  audience: "everyone",
});

export const toPresenterPayload = (
  state: SessionState,
  registry: ConnectionRegistry,
): PresenterPayload => ({
  ...toPresenterView(state),
  ...presenceOf(state, registry),
  audience: "presenter",
});

/**
 * Picks the payload a given recipient may receive.
 *
 * Two branches are enough only because the presenter holds every secret there
 * is: the candidates in `picking` and the topic in `presenting`. Everything else
 * 7.2 grants is public, the host included — the host may act on `next`, but
 * `revealed` opens the topic to everyone anyway, so there is nothing extra to
 * send them. Should host-only information ever appear, this split stops being
 * correct and needs a third payload rather than a wider public one.
 */
export const payloadFor = (
  state: SessionState,
  registry: ConnectionRegistry,
  recipientPlayerId: string,
): Payload => {
  const holdsSecrets = state.phase === "picking" || state.phase === "presenting";

  return holdsSecrets && presenterOf(state)?.id === recipientPlayerId
    ? toPresenterPayload(state, registry)
    : toPublicPayload(state, registry);
};

/**
 * Derived from the roster rather than from the seats, so the result can never
 * name somebody who is not playing, and a player the host registered before
 * they ever connected still counts as away.
 */
const presenceOf = (state: SessionState, registry: ConnectionRegistry): Presence => {
  const awayPlayerIds: string[] = [];
  const vacantPlayerIds: string[] = [];

  for (const player of state.players) {
    const seat = registry.seats.find((current) => current.playerId === player.id);
    if (seat && seat.connectionId !== null) continue;

    if (seat && isVacantSeat(seat)) vacantPlayerIds.push(player.id);
    else awayPlayerIds.push(player.id);
  }

  return { awayPlayerIds, vacantPlayerIds };
};
