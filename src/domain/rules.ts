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

/** Players required to start a game. */
export const MIN_PLAYERS = 2;
