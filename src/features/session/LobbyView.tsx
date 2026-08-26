import { useState } from "react";
import { PrimaryButton } from "../../components/buttons";
import { MIN_PLAYERS } from "../../domain/rules";
import type { SessionAction, SessionState } from "../../domain/session";

const ROUND_OPTIONS = [1, 2, 3, 4, 5];

export const LobbyView = ({
  state,
  dispatch,
}: {
  state: SessionState;
  dispatch: (action: SessionAction) => void;
}) => {
  const [name, setName] = useState("");

  const addPlayer = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    dispatch({ type: "addPlayer", id: crypto.randomUUID(), name: trimmed });
    setName("");
  };

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-bold tracking-[0.2em] text-slate-500">参加者</h2>

        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            addPlayer();
          }}
        >
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="名前"
            className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 placeholder:text-slate-600 focus:border-indigo-400 focus:outline-none"
          />
          <button
            type="submit"
            className="shrink-0 rounded-xl bg-slate-800 px-5 font-bold text-slate-200 transition active:scale-[0.98] hover:bg-slate-700"
          >
            追加
          </button>
        </form>

        {state.players.length === 0 ? (
          <p className="text-sm text-slate-500">まだ誰も登録されていない</p>
        ) : (
          <ol className="flex flex-wrap gap-2">
            {state.players.map((player, index) => (
              <li
                key={player.id}
                className="rounded-full bg-slate-800 px-3 py-1.5 text-sm text-slate-100"
              >
                {index + 1}. {player.name}
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-bold tracking-[0.2em] text-slate-500">終了条件</h2>
        <p className="text-sm text-slate-400">全員が指定の問数を出題したら終了</p>
        <div className="flex gap-2">
          {ROUND_OPTIONS.map((rounds) => (
            <button
              key={rounds}
              type="button"
              onClick={() => dispatch({ type: "setEndCondition", roundsPerPlayer: rounds })}
              className={`flex-1 rounded-xl border py-3 text-sm font-bold transition active:scale-[0.98] ${
                state.endCondition.roundsPerPlayer === rounds
                  ? "border-indigo-400 bg-indigo-500/20 text-indigo-200"
                  : "border-slate-700 bg-slate-900/60 text-slate-400 hover:border-slate-500"
              }`}
            >
              {rounds} 問
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <PrimaryButton
          onClick={() => dispatch({ type: "startGame" })}
          disabled={state.players.length < MIN_PLAYERS}
        >
          ゲーム開始
        </PrimaryButton>
        {state.players.length < MIN_PLAYERS && (
          <p className="text-center text-xs text-slate-500">
            開始には {MIN_PLAYERS} 名以上の登録が必要
          </p>
        )}
      </div>
    </section>
  );
};
