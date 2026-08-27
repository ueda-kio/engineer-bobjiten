import type { RoundAward } from "./score";
import type { EndCondition, Player, RevealedHelps, SessionState } from "./session";
import type { Category, Difficulty, Topic } from "./topic";

/**
 * What everyone may know about the topic while it is being presented (design 6.2).
 * Neither the word nor its id appears here: the topic list ships to every client,
 * so an id would give the answer away.
 */
export type PublicTopicHint = {
  difficulty: Difficulty;
  length: number;
  category?: Category;
  relatedWords?: string[];
};

type PublicBase = {
  players: Player[];
  scores: Record<string, number>;
  presentCounts: Record<string, number>;
  presenterIndex: number;
  hostId: string | null;
  endCondition: EndCondition;
  usedTopicsWereReset: boolean;
};

export type PublicSessionState = PublicBase &
  (
    | { phase: "lobby" }
    | { phase: "picking"; consumptions: number }
    | {
        phase: "presenting";
        consumptions: number;
        revealedHelps: RevealedHelps;
        topicHint: PublicTopicHint;
      }
    | {
        phase: "revealed";
        consumptions: number;
        topic: Topic;
        award: RoundAward;
        presenterId: string;
        answererId: string;
      }
    | { phase: "result" }
  );

/** The presenter sees everything. */
export type PresenterSessionState = SessionState;

export const toPresenterView = (state: SessionState): PresenterSessionState => state;

/**
 * Strips everything the answerers must not see.
 * `usedTopicIds` is dropped as well: it narrows down which words are still in
 * the pool, which is not information 6.2 grants to everyone.
 */
export const toPublicView = (state: SessionState): PublicSessionState => {
  const base: PublicBase = {
    players: state.players,
    scores: state.scores,
    presentCounts: state.presentCounts,
    presenterIndex: state.presenterIndex,
    hostId: state.hostId,
    endCondition: state.endCondition,
    usedTopicsWereReset: state.usedTopicsWereReset,
  };

  switch (state.phase) {
    case "lobby":
      return { ...base, phase: "lobby" };

    case "picking":
      return { ...base, phase: "picking", consumptions: state.consumptions };

    case "presenting":
      return {
        ...base,
        phase: "presenting",
        consumptions: state.consumptions,
        revealedHelps: state.revealedHelps,
        topicHint: toTopicHint(state.topic, state.revealedHelps),
      };

    case "revealed":
      return {
        ...base,
        phase: "revealed",
        consumptions: state.consumptions,
        topic: state.topic,
        award: state.award,
        presenterId: state.presenterId,
        answererId: state.answererId,
      };

    case "result":
      return { ...base, phase: "result" };
  }
};

const toTopicHint = (topic: Topic, revealedHelps: RevealedHelps): PublicTopicHint => ({
  difficulty: topic.difficulty,
  length: topic.word.length,
  ...(revealedHelps.category ? { category: topic.category } : {}),
  ...(revealedHelps.whitelist ? { relatedWords: topic.relatedWords } : {}),
});
