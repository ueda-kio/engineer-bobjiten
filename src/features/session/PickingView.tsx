import { DifficultyBadge } from "../../components/DifficultyBadge";
import type { PickedTopics } from "../../domain/pick";
import type { Player, SessionAction } from "../../domain/session";
import type { Difficulty } from "../../domain/topic";
import { settleRound } from "../../domain/score";
import { ResetNotice } from "./notices";

export const PickingView = ({
  presenter,
  candidates,
  consumptions,
  resetDifficulties,
  dispatch,
}: {
  presenter: Player;
  candidates: PickedTopics;
  consumptions: number;
  resetDifficulties: Difficulty[];
  dispatch: (action: SessionAction) => void;
}) => (
  <section className="flex flex-col gap-4">
    <p className="text-center text-sm text-slate-400">
      <span className="font-bold text-slate-100">{presenter.name}</span> が出題するお題を選ぶ
    </p>

    {resetDifficulties.length > 0 && <ResetNotice difficulties={resetDifficulties} />}

    <div className="flex flex-col gap-3">
      {candidates.map((topic) => (
        <button
          key={topic.id}
          type="button"
          onClick={() => dispatch({ type: "selectTopic", topicId: topic.id })}
          className="flex w-full flex-col items-start gap-2 rounded-2xl border border-slate-700 bg-slate-800/60 p-4 text-left transition active:scale-[0.98] hover:border-indigo-400"
        >
          <span className="flex w-full items-center justify-between">
            <DifficultyBadge difficulty={topic.difficulty} />
            {/* What this one is worth after what has already been spent. */}
            <span className="text-xs text-slate-400">
              選ぶと{" "}
              <span className="font-bold text-slate-200">
                {settleRound({ difficulty: topic.difficulty, consumptions }).presenter}点
              </span>
            </span>
          </span>
          <span className="text-2xl font-bold break-all text-slate-50">{topic.word}</span>
        </button>
      ))}
    </div>

    <button
      type="button"
      onClick={() => dispatch({ type: "redraw" })}
      className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-slate-400 underline-offset-4 hover:underline"
    >
      引き直す（−1点）
    </button>
  </section>
);
