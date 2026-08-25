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
  /** True when the used-topic history was cleared to keep the draw possible. */
  didResetUsed: boolean;
};

/**
 * Draws candidates while skipping already-presented topics.
 * When any difficulty has run out, the history is discarded and every topic
 * becomes available again, so the caller can tell players why words repeat.
 */
export const pickCandidates = (
  topics: Topic[],
  usedTopicIds: readonly string[],
  rng: Rng,
): CandidatePick => {
  const used = new Set(usedTopicIds);
  const remaining = topics.filter((topic) => !used.has(topic.id));
  const isDrawable = DIFFICULTIES.every((difficulty) =>
    remaining.some((topic) => topic.difficulty === difficulty),
  );

  return isDrawable
    ? { candidates: pickTopics(remaining, rng), didResetUsed: false }
    : { candidates: pickTopics(topics, rng), didResetUsed: true };
};

const pickByDifficulty = (topics: Topic[], difficulty: Difficulty, rng: Rng): Topic => {
  const candidates = topics.filter((topic) => topic.difficulty === difficulty);
  if (candidates.length === 0) {
    throw new Error(`No topic available for difficulty ${difficulty}`);
  }
  return candidates[Math.floor(rng() * candidates.length)];
};
