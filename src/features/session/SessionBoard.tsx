import type { Payload, PresenterPayload, PublicPayload } from "../../domain/payload";
import type { SessionAction } from "../../domain/session";
import { LobbyView } from "./LobbyView";
import { PickingView } from "./PickingView";
import { PresentingView } from "./PresentingView";
import { ResultView } from "./ResultView";
import { RevealedView } from "./RevealedView";
import { Scoreboard } from "./Scoreboard";
import { WaitingView } from "./WaitingView";

type BoardProps = {
  payload: Payload;
  viewerId: string;
  dispatch: (action: SessionAction) => void;
  onReleaseSeat: (playerId: string) => void;
};

/**
 * The game, drawn from whatever this viewer was sent.
 *
 * The split below is on `audience`, not on whether a topic happens to be
 * present: an answerer's payload has no `topic` field at all (design 7.2), and
 * checking for one at runtime would invite putting it back.
 */
export const SessionBoard = ({ payload, viewerId, dispatch, onReleaseSeat }: BoardProps) => {
  const presenter = payload.players[payload.presenterIndex];
  const isHost = viewerId === payload.hostId;

  return (
    <div className="flex flex-col gap-6">
      {payload.phase !== "lobby" && (
        <Scoreboard
          players={payload.players}
          scores={payload.scores}
          presentCounts={payload.presentCounts}
          presenterId={presenter?.id}
          hostId={payload.hostId}
          awayPlayerIds={payload.awayPlayerIds}
          vacantPlayerIds={payload.vacantPlayerIds}
          onReleaseSeat={isHost ? onReleaseSeat : undefined}
        />
      )}

      {payload.phase === "lobby" && (
        <LobbyView
          players={payload.players}
          hostId={payload.hostId}
          endCondition={payload.endCondition}
          awayPlayerIds={payload.awayPlayerIds}
          vacantPlayerIds={payload.vacantPlayerIds}
          isHost={isHost}
          dispatch={dispatch}
          onReleaseSeat={onReleaseSeat}
        />
      )}

      {payload.phase === "revealed" && (
        <RevealedView
          topic={payload.topic}
          award={payload.award}
          consumptions={payload.consumptions}
          presenter={payload.players.find((player) => player.id === payload.presenterId)}
          answerer={payload.players.find((player) => player.id === payload.answererId)}
          isLastRound={payload.players.every(
            (player) =>
              (payload.presentCounts[player.id] ?? 0) >= payload.endCondition.roundsPerPlayer,
          )}
          dispatch={dispatch}
        />
      )}

      {payload.phase === "result" && (
        <ResultView
          players={payload.players}
          scores={payload.scores}
          presentCounts={payload.presentCounts}
          canRestart={isHost}
          dispatch={dispatch}
        />
      )}

      {payload.audience === "presenter" ? (
        <PresenterRound payload={payload} dispatch={dispatch} />
      ) : (
        <AnswererRound payload={payload} />
      )}
    </div>
  );
};

/** Only reached by the current presenter, so the candidates and topic are theirs. */
const PresenterRound = ({
  payload,
  dispatch,
}: {
  payload: PresenterPayload;
  dispatch: (action: SessionAction) => void;
}) => {
  const presenter = payload.players[payload.presenterIndex];
  if (!presenter) return null;

  if (payload.phase === "picking") {
    return (
      <PickingView
        presenter={presenter}
        candidates={payload.candidates}
        consumptions={payload.consumptions}
        resetDifficulties={payload.resetDifficulties}
        dispatch={dispatch}
      />
    );
  }

  if (payload.phase === "presenting") {
    return (
      <PresentingView
        presenter={presenter}
        others={payload.players.filter((player) => player.id !== presenter.id)}
        topic={payload.topic}
        consumptions={payload.consumptions}
        revealedHelps={payload.revealedHelps}
        dispatch={dispatch}
      />
    );
  }

  return null;
};

/** Everybody else: the word never reaches this branch, only what 7.2 allows. */
const AnswererRound = ({ payload }: { payload: PublicPayload }) => {
  const presenter = payload.players[payload.presenterIndex];
  if (!presenter) return null;

  if (payload.phase === "picking") {
    return <WaitingView presenter={presenter} resetDifficulties={payload.resetDifficulties} />;
  }

  if (payload.phase === "presenting") {
    return (
      <WaitingView
        presenter={presenter}
        hint={payload.topicHint}
        consumptions={payload.consumptions}
        resetDifficulties={payload.resetDifficulties}
      />
    );
  }

  return null;
};
