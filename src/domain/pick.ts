import type { Rng } from "./rng";
import { DIFFICULTIES, type Difficulty, type Topic } from "./topic";

/** One candidate per difficulty, ordered from 1 to 3. */
export type PickedTopics = readonly [Topic, Topic, Topic];

export const pickTopics = (topics: Topic[], rng: Rng): PickedTopics => {
  const [easy, normal, hard] = DIFFICULTIES.map((difficulty) =>
    pickByDifficulty(topics, difficulty, rng),
  );
  return [easy, normal, hard];
};

export type CandidatePick = {
  candidates: PickedTopics;
  /** The history after the draw, with exhausted difficulties cleared. */
  usedTopicIds: string[];
  /** Difficulties whose history was cleared to keep the draw possible. */
  resetDifficulties: Difficulty[];
};

/**
 * Draws candidates while skipping already-presented topics.
 *
 * Exhaustion is judged per difficulty: when one runs out, only that
 * difficulty's history is cleared. Clearing all three would let the first
 * difficulty to run dry discard the others' history, which resets far more
 * often than the word supply requires.
 */
export const pickCandidates = (
  topics: Topic[],
  usedTopicIds: readonly string[],
  rng: Rng,
): CandidatePick => {
  const used = new Set(usedTopicIds);
  const resetDifficulties: Difficulty[] = [];

  const [easy, normal, hard] = DIFFICULTIES.map((difficulty) => {
    const all = topics.filter((topic) => topic.difficulty === difficulty);
    const remaining = all.filter((topic) => !used.has(topic.id));
    if (remaining.length > 0) return pickFrom(remaining, difficulty, rng);

    resetDifficulties.push(difficulty);
    for (const topic of all) used.delete(topic.id);
    return pickFrom(all, difficulty, rng);
  });

  return {
    candidates: [easy, normal, hard],
    usedTopicIds: usedTopicIds.filter((id) => used.has(id)),
    resetDifficulties,
  };
};

const pickByDifficulty = (topics: Topic[], difficulty: Difficulty, rng: Rng): Topic =>
  pickFrom(
    topics.filter((topic) => topic.difficulty === difficulty),
    difficulty,
    rng,
  );

const pickFrom = (candidates: Topic[], difficulty: Difficulty, rng: Rng): Topic => {
  if (candidates.length === 0) {
    throw new Error(`No topic available for difficulty ${difficulty}`);
  }
  return candidates[Math.floor(rng() * candidates.length)];
};
