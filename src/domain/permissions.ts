import { presenterOf, type ActingContext, type SessionAction } from "./session";

/**
 * Whether `actorId` is allowed to perform `action` right now (design 7.1).
 *
 * Kept outside `reduceSession` on purpose: who sent a message is knowledge of
 * the transport, not of the state machine. The server calls this before
 * reducing, and the screen calls it again to decide which buttons to draw. The
 * screen's answer is only a courtesy — the server's is the one that counts,
 * since the two can disagree for a moment after the host role moves.
 */
export const canPerform = (
  state: ActingContext,
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

    // Nobody's to perform: design 7.1 gives host handover to the sync layer,
    // which applies it directly when the away timer runs out. Letting a client
    // send it would be a way to take the host role from whoever holds it.
    case "transferHost":
      return false;
  }
};

/**
 * Whether `actorId` may release `targetPlayerId`'s seat (design 7.1).
 *
 * Separate from `canPerform` because releasing a seat is not a `SessionAction`:
 * the seat lives in the connection registry, not in the game state. The rule
 * still belongs here so that no permission check is written anywhere else.
 *
 * The `targetPlayerId !== state.hostId` half is a stopgap, not a rule of the
 * game: releasing a seat clears its token, so a host who released their own
 * would leave nobody able to start, skip or restart, and the game would be
 * stuck for good. Design 6.6 hands the role to another player once handover
 * exists — implement that and this half should be removed, since a host who
 * genuinely lost their token needs their seat freed like anyone else.
 */
export const canReleaseSeat = (
  state: ActingContext,
  actorId: string,
  targetPlayerId: string,
): boolean => actorId === state.hostId && targetPlayerId !== state.hostId;
