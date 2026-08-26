import type { SessionState } from "../../domain/session";

/** Players in registration order, with the current presenter marked. */
export const Scoreboard = ({
  state,
  presenterId,
}: {
  state: SessionState;
  presenterId?: string;
}) => (
  <ul className="divide-y divide-slate-800 rounded-2xl border border-slate-800 bg-slate-900/60">
    {state.players.map((player) => (
      <li key={player.id} className="flex items-center justify-between px-4 py-2.5">
        <span className="flex items-center gap-2 text-sm text-slate-200">
          {player.name}
          {player.id === presenterId && (
            <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs text-indigo-300">
              出題中
            </span>
          )}
        </span>
        <span className="flex items-baseline gap-2">
          <span className="text-xs text-slate-500">
            {state.presentCounts[player.id] ?? 0} 問出題
          </span>
          <span className="text-base font-bold text-slate-100">{state.scores[player.id] ?? 0}</span>
        </span>
      </li>
    ))}
  </ul>
);
