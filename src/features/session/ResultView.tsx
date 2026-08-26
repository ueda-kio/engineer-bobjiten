import { SecondaryButton } from "../../components/buttons";
import type { SessionAction, SessionState } from "../../domain/session";
import { rankPlayers } from "./ranking";

const MEDAL = ["🥇", "🥈", "🥉"];

export const ResultView = ({
  state,
  dispatch,
}: {
  state: SessionState;
  dispatch: (action: SessionAction) => void;
}) => (
  <section className="flex flex-col gap-6">
    <h2 className="text-center text-2xl font-black text-slate-50">最終結果</h2>

    <ol className="divide-y divide-slate-800 rounded-2xl border border-slate-800 bg-slate-900/60">
      {rankPlayers(state.players, state.scores).map((player, index) => (
        <li key={player.id} className="flex items-center justify-between px-4 py-3">
          <span className="flex items-center gap-3 text-slate-100">
            <span className="w-6 text-center text-sm">{MEDAL[index] ?? index + 1}</span>
            {player.name}
          </span>
          <span className="flex items-baseline gap-2">
            <span className="text-xs text-slate-500">
              {state.presentCounts[player.id] ?? 0} 問出題
            </span>
            <span className="text-xl font-black text-slate-50">{state.scores[player.id] ?? 0}</span>
          </span>
        </li>
      ))}
    </ol>

    <SecondaryButton onClick={() => dispatch({ type: "restart" })}>もう一度</SecondaryButton>
  </section>
);
