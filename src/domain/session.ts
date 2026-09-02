import { pickCandidates, type PickedTopics } from "./pick";
import type { Rng } from "./rng";
import {
  CONSUMPTION_COST,
  DEFAULT_ROUNDS_PER_PLAYER,
  KATAKANA_REPORT_REWARD,
  MAX_ROUNDS_PER_PLAYER,
  MIN_PLAYERS,
} from "./rules";
import { settleRound, type RoundAward } from "./score";
import type { Difficulty, Topic } from "./topic";

export type Player = {
  id: string;
  name: string;
};

export type EndCondition = {
  type: "rounds";
  roundsPerPlayer: number;
};

export type HelpKind = "category" | "whitelist" | "oneKatakana";

export type RevealedHelps = Record<HelpKind, boolean>;

type SessionBase = {
  players: Player[];
  /** The first registered player. Null until someone joins. */
  hostId: string | null;
  scores: Record<string, number>;
  /** Rounds each player has presented. Only answered rounds are counted. */
  presentCounts: Record<string, number>;
  presenterIndex: number;
  endCondition: EndCondition;
  usedTopicIds: string[];
  /** Difficulties whose history the most recent draw had to clear. */
  resetDifficulties: Difficulty[];
};

export type SessionState = SessionBase &
  (
    | { phase: "lobby" }
    | { phase: "picking"; candidates: PickedTopics; consumptions: number }
    | { phase: "presenting"; topic: Topic; consumptions: number; revealedHelps: RevealedHelps }
    | {
        phase: "revealed";
        topic: Topic;
        consumptions: number;
        award: RoundAward;
        presenterId: string;
        answererId: string;
      }
    | { phase: "result" }
  );

export type SessionAction =
  | { type: "addPlayer"; id: string; name: string }
  | { type: "setEndCondition"; roundsPerPlayer: number }
  | { type: "startGame" }
  | { type: "selectTopic"; topicId: string }
  | { type: "redraw" }
  | { type: "useHelp"; kind: HelpKind }
  | { type: "acceptKatakanaReport"; reporterId: string }
  | { type: "confirmAnswerer"; playerId: string }
  | { type: "next" }
  | { type: "restart" }
  | { type: "forceSkip" }
  /**
   * Moves the host role to another player (design 6.6).
   *
   * Applied by the sync layer alone, which is the only part that can see who is
   * still connected. Choosing the successor is its job; this only writes it.
   */
  | { type: "transferHost"; playerId: string };

export type SessionDeps = {
  topics: Topic[];
  rng: Rng;
};

const NO_HELPS: RevealedHelps = { category: false, whitelist: false, oneKatakana: false };

export const createSession = (): SessionState => ({
  phase: "lobby",
  players: [],
  hostId: null,
  scores: {},
  presentCounts: {},
  presenterIndex: 0,
  endCondition: { type: "rounds", roundsPerPlayer: DEFAULT_ROUNDS_PER_PLAYER },
  usedTopicIds: [],
  resetDifficulties: [],
});

export const presenterOf = (state: SessionState): Player | undefined =>
  state.players[state.presenterIndex];

/**
 * The phase 2 state machine.
 * Actions that the current phase does not define return the state unchanged,
 * so callers can dispatch without knowing the phase.
 */
export const reduceSession = (
  state: SessionState,
  action: SessionAction,
  deps: SessionDeps,
): SessionState => {
  switch (action.type) {
    case "addPlayer":
      return state.phase === "lobby"
        ? {
            ...state,
            players: [...state.players, { id: action.id, name: action.name }],
            hostId: state.hostId ?? action.id,
          }
        : state;

    case "setEndCondition":
      return state.phase === "lobby" && isPlayableRounds(action.roundsPerPlayer)
        ? { ...state, endCondition: { type: "rounds", roundsPerPlayer: action.roundsPerPlayer } }
        : state;

    case "startGame": {
      if (state.phase !== "lobby" || state.players.length < MIN_PLAYERS) return state;
      return {
        ...state,
        ...drawInto(state.usedTopicIds, deps),
        scores: zeroed(state.players),
        presentCounts: zeroed(state.players),
        presenterIndex: 0,
        consumptions: 0,
      };
    }

    case "selectTopic": {
      if (state.phase !== "picking") return state;
      const topic = state.candidates.find((candidate) => candidate.id === action.topicId);
      if (!topic) return state;
      return {
        ...withoutPhaseData(state),
        phase: "presenting",
        topic,
        consumptions: state.consumptions,
        revealedHelps: NO_HELPS,
        usedTopicIds: [...state.usedTopicIds, topic.id],
      };
    }

    case "redraw": {
      if (state.phase !== "picking" && state.phase !== "presenting") return state;
      return {
        ...withoutPhaseData(state),
        ...drawInto(state.usedTopicIds, deps),
        consumptions: state.consumptions + CONSUMPTION_COST,
      };
    }

    case "useHelp": {
      if (state.phase !== "presenting" || state.revealedHelps[action.kind]) return state;
      return {
        ...state,
        revealedHelps: { ...state.revealedHelps, [action.kind]: true },
        consumptions: state.consumptions + CONSUMPTION_COST,
      };
    }

    case "acceptKatakanaReport": {
      if (state.phase !== "presenting") return state;
      const presenter = presenterOf(state);
      if (!presenter || action.reporterId === presenter.id) return state;
      if (!(action.reporterId in state.scores)) return state;
      return { ...state, scores: added(state.scores, action.reporterId, KATAKANA_REPORT_REWARD) };
    }

    case "confirmAnswerer": {
      if (state.phase !== "presenting") return state;
      const presenter = presenterOf(state);
      if (!presenter || action.playerId === presenter.id) return state;
      if (!(action.playerId in state.scores)) return state;

      const award = settleRound({
        difficulty: state.topic.difficulty,
        consumptions: state.consumptions,
      });
      return {
        ...withoutPhaseData(state),
        phase: "revealed",
        topic: state.topic,
        consumptions: state.consumptions,
        award,
        presenterId: presenter.id,
        answererId: action.playerId,
        scores: added(
          added(state.scores, presenter.id, award.presenter),
          action.playerId,
          award.answerer,
        ),
        presentCounts: added(state.presentCounts, presenter.id, 1),
      };
    }

    case "next": {
      if (state.phase !== "revealed") return state;
      if (isEndConditionMet(state)) return { ...withoutPhaseData(state), phase: "result" };
      return {
        ...withoutPhaseData(state),
        ...drawInto(state.usedTopicIds, deps),
        presenterIndex: (state.presenterIndex + 1) % state.players.length,
        consumptions: 0,
      };
    }

    case "forceSkip": {
      if (state.phase !== "picking" && state.phase !== "presenting") return state;
      return {
        ...withoutPhaseData(state),
        ...drawInto(state.usedTopicIds, deps),
        presenterIndex: (state.presenterIndex + 1) % state.players.length,
        consumptions: 0,
      };
    }

    case "transferHost":
      return state.players.some((player) => player.id === action.playerId)
        ? { ...state, hostId: action.playerId }
        : state;

    case "restart":
      return state.phase === "result"
        ? {
            ...createSession(),
            players: state.players,
            hostId: state.hostId,
            scores: zeroed(state.players),
            presentCounts: zeroed(state.players),
            endCondition: state.endCondition,
          }
        : state;
  }
};

/** Whether every player has presented the required number of answered rounds. */
export const isEndConditionMet = (state: SessionState): boolean =>
  state.players.every(
    (player) => (state.presentCounts[player.id] ?? 0) >= state.endCondition.roundsPerPlayer,
  );

/**
 * Out-of-range end conditions are ignored rather than clamped.
 *
 * A value past the cap does not fail loudly: `isEndConditionMet` simply never
 * holds, so the game can never reach `result` and "もう一度" never becomes
 * available. There is no way back from that inside a session.
 */
const isPlayableRounds = (rounds: number): boolean =>
  Number.isInteger(rounds) && rounds >= 1 && rounds <= MAX_ROUNDS_PER_PLAYER;

const zeroed = (players: Player[]): Record<string, number> =>
  Object.fromEntries(players.map((player) => [player.id, 0]));

const added = (
  scores: Record<string, number>,
  playerId: string,
  points: number,
): Record<string, number> => ({ ...scores, [playerId]: (scores[playerId] ?? 0) + points });

/** Draws the next candidates, carrying over which histories had to be cleared. */
const drawInto = (usedTopicIds: string[], deps: SessionDeps) => {
  const pick = pickCandidates(deps.topics, usedTopicIds, deps.rng);
  return {
    phase: "picking",
    candidates: pick.candidates,
    usedTopicIds: pick.usedTopicIds,
    resetDifficulties: pick.resetDifficulties,
  } as const;
};

/** Strips phase-specific fields so a spread cannot leak them into the next phase. */
const withoutPhaseData = (state: SessionState): SessionBase => ({
  players: state.players,
  hostId: state.hostId,
  scores: state.scores,
  presentCounts: state.presentCounts,
  presenterIndex: state.presenterIndex,
  endCondition: state.endCondition,
  usedTopicIds: state.usedTopicIds,
  resetDifficulties: state.resetDifficulties,
});
