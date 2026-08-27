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
  const isRegistered = state.players.some((player) => player.id === actorId);
  const isHost = actorId === state.hostId;

  // Joining is done by the player themselves; the first to join becomes host.
  // Adding somebody else is a host action.
  if (action.type === "addPlayer") {
    return (action.id === actorId && !isRegistered) || isHost;
  }

  if (!isRegistered) return false;

  const isPresenter = presenterOf(state)?.id === actorId;

  switch (action.type) {
    case "setEndCondition":
    case "startGame":
    case "restart":
    case "forceSkip":
      return isHost;

    // Either may advance, so the game does not stall while the host is talking.
    case "next":
      return isHost || isPresenter;

    case "selectTopic":
    case "redraw":
    case "useHelp":
    case "confirmAnswerer":
      return isPresenter;

    // The reported player admits the violation; answerers cannot award themselves.
    case "acceptKatakanaReport":
      return isPresenter;
  }
};
