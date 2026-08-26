import { useCallback, useReducer } from "react";
import { TOPICS } from "../../data/topics";
import { defaultRng, type Rng } from "../../domain/rng";
import {
  createSession,
  reduceSession,
  type SessionAction,
  type SessionState,
} from "../../domain/session";
import type { Topic } from "../../domain/topic";

/**
 * Binds the phase 2 state machine to React.
 * All rules live in `reduceSession`; this hook only supplies the dependencies.
 */
export const useSession = (topics: Topic[] = TOPICS, rng: Rng = defaultRng) => {
  const reduce = useCallback(
    (state: SessionState, action: SessionAction) => reduceSession(state, action, { topics, rng }),
    [topics, rng],
  );
  const [state, dispatch] = useReducer(reduce, undefined, createSession);

  return { state, dispatch };
};
