import { presenterOf, type SessionAction, type SessionState } from "./session";

/**
 * Whether `actorId` is allowed to perform `action` right now (design 6.1).
 *
 * Kept outside `reduceSession` on purpose: who sent a message is knowledge of
 * the transport, not of the state machine. The synced server must call this
 * before reducing; the single-device host screen reduces without it.
 */
export const canPerform = (
  state: SessionState,
  action: SessionAction,
  actorId: string,
): boolean => {
  // Nobody is registered yet, so the first player registers themselves and becomes host.
  if (state.hostId === null) return action.type === "addPlayer";
  if (!state.players.some((player) => player.id === actorId)) return false;

  const isHost = actorId === state.hostId;
  const isPresenter = presenterOf(state)?.id === actorId;

  switch (action.type) {
    case "addPlayer":
    case "setEndCondition":
    case "startGame":
    case "next":
    case "restart":
    case "forceSkip":
      return isHost;

    case "selectTopic":
    case "redraw":
    case "useHelp":
    case "confirmAnswerer":
      return isPresenter;

    case "acceptKatakanaReport":
      return !isPresenter;
  }
};
