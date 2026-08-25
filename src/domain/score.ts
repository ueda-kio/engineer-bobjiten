import type { Difficulty } from "./topic";

export type RoundAward = {
  presenter: number;
  answerer: number;
};

/**
 * Points for one answered round.
 * The answerer always gets the full difficulty; the presenter pays for every
 * redraw and help they used, but never drops below zero.
 */
export const settleRound = ({
  difficulty,
  consumptions,
}: {
  difficulty: Difficulty;
  consumptions: number;
}): RoundAward => ({
  presenter: Math.max(0, difficulty - consumptions),
  answerer: difficulty,
});
