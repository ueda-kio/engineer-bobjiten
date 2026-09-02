/**
 * Tuning parameters for phase 2 scoring and end conditions.
 * Kept in one place so play-testing can adjust them without hunting through modules.
 */

/** Added to the presenter's consumption count per redraw or help usage. */
export const CONSUMPTION_COST = 1;

/** Points given to a player whose katakana report the presenter accepts. */
export const KATAKANA_REPORT_REWARD = 1;

/** Rounds each player must present before the game ends. */
export const DEFAULT_ROUNDS_PER_PLAYER = 3;

/**
 * Most rounds each player may be asked to present.
 *
 * Ten is already about three hours at seven players and the observed 2-3
 * minutes a round. Beyond this the end condition is unreachable in practice and
 * the room can never reach `result`, so a larger value is treated as a slip.
 */
export const MAX_ROUNDS_PER_PLAYER = 10;

/** Players required to start a game. */
export const MIN_PLAYERS = 2;

/**
 * How long a disconnected presenter or host is waited for before the sync layer
 * steps in (design 6.5, 6.6).
 *
 * Not to be shortened: a minute or so would skip players who merely stepped
 * away, which the design calls out as the failure to avoid.
 */
export const AWAY_GRACE_MS = 3 * 60 * 1000;

/** How long a room outlives its last operation before being discarded (design 6.7). */
export const ROOM_LIFETIME_MS = 24 * 60 * 60 * 1000;
