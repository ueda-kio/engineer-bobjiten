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

const pickByDifficulty = (topics: Topic[], difficulty: Difficulty, rng: Rng): Topic => {
  const candidates = topics.filter((topic) => topic.difficulty === difficulty);
  if (candidates.length === 0) {
    throw new Error(`No topic available for difficulty ${difficulty}`);
  }
  return candidates[Math.floor(rng() * candidates.length)];
};
