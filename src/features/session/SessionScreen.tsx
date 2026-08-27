import { isEndConditionMet, presenterOf } from "../../domain/session";
import { LobbyView } from "./LobbyView";
import { PickingView } from "./PickingView";
import { PresentingView } from "./PresentingView";
import { ResultView } from "./ResultView";
import { RevealedView } from "./RevealedView";
import { Scoreboard } from "./Scoreboard";
import { useSession } from "./useSession";

export const SessionScreen = () => {
  const { state, dispatch } = useSession();
  const presenter = presenterOf(state);
  const others = state.players.filter((player) => player.id !== presenter?.id);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-5 py-8">
      <header className="text-center">
        <h1 className="text-2xl font-black tracking-tight text-slate-50">
          エンジニア縛りボブジテン
        </h1>
        {state.phase !== "lobby" && (
          <p className="mt-1 text-xs text-slate-500">
            全員 {state.endCondition.roundsPerPlayer} 問出題で終了
          </p>
        )}
      </header>

      {state.phase === "lobby" && <LobbyView state={state} dispatch={dispatch} />}

      {state.phase === "picking" && presenter && (
        <PickingView
          presenter={presenter}
          candidates={state.candidates}
          consumptions={state.consumptions}
          resetDifficulties={state.resetDifficulties}
          dispatch={dispatch}
        />
      )}

      {state.phase === "presenting" && presenter && (
        <PresentingView
          presenter={presenter}
          others={others}
          topic={state.topic}
          consumptions={state.consumptions}
          revealedHelps={state.revealedHelps}
          dispatch={dispatch}
        />
      )}

      {state.phase === "revealed" && (
        <RevealedView
          topic={state.topic}
          award={state.award}
          consumptions={state.consumptions}
          presenter={state.players.find((player) => player.id === state.presenterId)}
          answerer={state.players.find((player) => player.id === state.answererId)}
          isLastRound={isEndConditionMet(state)}
          dispatch={dispatch}
        />
      )}

      {state.phase === "result" && <ResultView state={state} dispatch={dispatch} />}

      {state.phase !== "lobby" && state.phase !== "result" && (
        <div className="mt-auto flex flex-col gap-2">
          <h2 className="text-xs font-bold tracking-[0.2em] text-slate-500">得点</h2>
          <Scoreboard state={state} presenterId={presenter?.id} />
        </div>
      )}
    </div>
  );
};
