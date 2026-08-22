import { useCallback, useState } from "react";
import { pickTopics, type PickedTopics } from "../../domain/pick";
import { defaultRng, type Rng } from "../../domain/rng";
import type { Topic } from "../../domain/topic";

export type GameState =
  | { phase: "idle" }
  | { phase: "picking"; candidates: PickedTopics }
  | {
      phase: "presenting";
      topic: Topic;
      categoryRevealed: boolean;
      whitelistRevealed: boolean;
    };

export const useGame = (topics: Topic[], rng: Rng = defaultRng) => {
  const [state, setState] = useState<GameState>({ phase: "idle" });

  const draw = useCallback(() => {
    setState({ phase: "picking", candidates: pickTopics(topics, rng) });
  }, [topics, rng]);

  const select = useCallback((topic: Topic) => {
    setState({ phase: "presenting", topic, categoryRevealed: false, whitelistRevealed: false });
  }, []);

  const revealCategory = useCallback(() => {
    setState((current) =>
      current.phase === "presenting" ? { ...current, categoryRevealed: true } : current,
    );
  }, []);

  const revealWhitelist = useCallback(() => {
    setState((current) =>
      current.phase === "presenting" ? { ...current, whitelistRevealed: true } : current,
    );
  }, []);

  return { state, draw, redraw: draw, select, revealCategory, revealWhitelist };
};
