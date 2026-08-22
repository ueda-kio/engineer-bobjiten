/** Returns a number in [0, 1). */
export type Rng = () => number;

export const defaultRng: Rng = Math.random;
