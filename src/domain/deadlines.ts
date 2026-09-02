/**
 * When the sync layer has to step in for somebody who is not there (design 6.5-6.8).
 *
 * Pure: `now` arrives as an argument rather than being read from the clock, for
 * the same reason `Rng` is injected — a deadline that depends on the ambient
 * time cannot be reasoned about in a test.
 *
 * Only three deadlines exist and only one alarm can be pending (design 6.8), so
 * they are stored together, the alarm is set to the earliest, and every firing
 * settles all of the ones that have come due.
 */

import type { ConnectionRegistry } from "./connection";
import { AWAY_GRACE_MS, ROOM_LIFETIME_MS } from "./rules";
import { presenterOf, type SessionState } from "./session";

/**
 * A pending deadline and who it is about.
 *
 * The player id is what keeps a deadline honest: without it, a presenter who
 * changes while away would inherit their predecessor's remaining time and be
 * skipped early.
 */
export type Deadline = {
  at: number;
  playerId: string;
};

export type Deadlines = {
  /** The away presenter gets skipped (design 6.5). */
  presenterSkip: Deadline | null;
  /** The away host's role moves on (design 6.6). */
  hostHandover: Deadline | null;
  /** The room is discarded (design 6.7). Always set. */
  roomExpiresAt: number;
};

export type DeadlineKind = "presenterSkip" | "hostHandover" | "roomExpired";

export const createDeadlines = (now: number): Deadlines => ({
  presenterSkip: null,
  hostHandover: null,
  roomExpiresAt: now + ROOM_LIFETIME_MS,
});

/**
 * Works out the deadlines that should stand now. Call it after anything that
 * changes the state or the registry, and after every alarm.
 *
 * `roomExpiresAt` is carried over untouched: 6.7 measures the room's life from
 * the last operation, and a disconnect is not one. Without that, seven phones
 * going to sleep at the end of the night would push the room another day out.
 */
export const nextDeadlines = (
  previous: Deadlines,
  state: SessionState,
  registry: ConnectionRegistry,
  now: number,
): Deadlines => ({
  presenterSkip: awayDeadline(previous.presenterSkip, skippablePresenterId(state, registry), now),
  hostHandover: awayDeadline(previous.hostHandover, replaceableHostId(state, registry), now),
  roomExpiresAt: previous.roomExpiresAt,
});

/** Restarts the room's lifetime. Only an operation counts as use (design 6.7). */
export const touchRoomLifetime = (deadlines: Deadlines, now: number): Deadlines => ({
  ...deadlines,
  roomExpiresAt: now + ROOM_LIFETIME_MS,
});

/** The single alarm the room arms, per design 6.8. */
export const earliestDeadline = (deadlines: Deadlines): number =>
  Math.min(
    deadlines.roomExpiresAt,
    ...[deadlines.presenterSkip, deadlines.hostHandover]
      .filter((deadline): deadline is Deadline => deadline !== null)
      .map((deadline) => deadline.at),
  );

/** Everything that has come due, since one alarm stands in for all three. */
export const dueDeadlines = (deadlines: Deadlines, now: number): DeadlineKind[] => {
  const due: DeadlineKind[] = [];

  if (deadlines.presenterSkip !== null && deadlines.presenterSkip.at <= now) {
    due.push("presenterSkip");
  }
  if (deadlines.hostHandover !== null && deadlines.hostHandover.at <= now) {
    due.push("hostHandover");
  }
  if (deadlines.roomExpiresAt <= now) due.push("roomExpired");

  return due;
};

/**
 * Who takes the host role over (design 6.6): the first player on the roster,
 * other than the host, who is connected right now.
 *
 * Deciding this needs the registry, which is why it is the sync layer that
 * chooses and `reduceSession` that merely records the result.
 */
export const hostSuccessor = (state: SessionState, registry: ConnectionRegistry): string | null =>
  state.players.find((player) => player.id !== state.hostId && isConnected(registry, player.id))
    ?.id ?? null;

/**
 * Keeps a deadline that is already running for the same player, and starts a
 * fresh one otherwise.
 *
 * Keeping it stops an unrelated event — somebody else's move — from restarting
 * the clock on a player who has been away all along. Replacing an expired one
 * stops a deadline that could not be acted upon from firing again immediately.
 */
const awayDeadline = (
  previous: Deadline | null,
  playerId: string | null,
  now: number,
): Deadline | null => {
  if (playerId === null) return null;
  if (previous !== null && previous.playerId === playerId && previous.at > now) return previous;

  return { at: now + AWAY_GRACE_MS, playerId };
};

/** The presenter to skip, if there is a round to skip and they are not here. */
const skippablePresenterId = (state: SessionState, registry: ConnectionRegistry): string | null => {
  // `forceSkip` only does anything mid-round, so arming it elsewhere would fire
  // an alarm that changes nothing.
  if (state.phase !== "picking" && state.phase !== "presenting") return null;

  const presenter = presenterOf(state);
  if (presenter === undefined || isConnected(registry, presenter.id)) return null;

  return presenter.id;
};

/** The host to replace, if they are away and somebody can actually take over. */
const replaceableHostId = (state: SessionState, registry: ConnectionRegistry): string | null => {
  const { hostId } = state;
  if (hostId === null || isConnected(registry, hostId)) return null;

  // With nobody to hand the role to, arming this would just wake the room every
  // few minutes until it expires. A later connection is itself a recompute, so
  // the deadline starts then instead.
  return hostSuccessor(state, registry) === null ? null : hostId;
};

const isConnected = (registry: ConnectionRegistry, playerId: string): boolean =>
  registry.seats.some((seat) => seat.playerId === playerId && seat.connectionId !== null);
