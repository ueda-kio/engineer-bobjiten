import { DifficultyBadge } from "../../components/DifficultyBadge";
import type { PublicTopicHint } from "../../domain/view";
import type { Player } from "../../domain/session";
import type { Difficulty } from "../../domain/topic";
import { ConsumptionNotice, ResetNotice } from "./notices";

/**
 * What an answerer sees while somebody else holds the topic.
 *
 * The hint is everything design 7.2 lets the table know: how hard the word is,
 * how long it is, and whatever the presenter has paid to reveal.
 */
export const WaitingView = ({
  presenter,
  hint,
  consumptions,
  resetDifficulties,
}: {
  presenter: Player;
  hint?: PublicTopicHint;
  consumptions?: number;
  resetDifficulties: Difficulty[];
}) => (
  <section className="flex flex-col gap-4">
    {resetDifficulties.length > 0 && <ResetNotice difficulties={resetDifficulties} />}

    {hint === undefined ? (
      <p className="rounded-3xl border border-slate-800 bg-slate-900/60 px-4 py-10 text-center text-sm text-slate-400">
        <span className="font-bold text-slate-100">{presenter.name}</span> がお題を選んでいる
      </p>
    ) : (
      <div className="flex flex-col items-center gap-4 rounded-3xl border border-slate-800 bg-slate-900/60 px-4 py-8">
        <p className="text-xs tracking-[0.2em] text-slate-500">出題中</p>
        <DifficultyBadge difficulty={hint.difficulty} />
        <p className="text-center text-3xl font-black tracking-[0.3em] text-slate-600">
          {"◯".repeat(hint.length)}
        </p>
        <p className="text-xs text-slate-500">{hint.length} 文字</p>

        {hint.category !== undefined && (
          <p className="text-sm text-slate-300">
            カテゴリ: <span className="font-bold text-slate-100">{hint.category}</span>
          </p>
        )}

        {hint.relatedWords !== undefined && (
          <div className="flex flex-col items-center gap-1">
            <p className="text-xs text-slate-500">解禁された語</p>
            <p className="text-center text-sm text-slate-200">{hint.relatedWords.join("・")}</p>
          </div>
        )}
      </div>
    )}

    <p className="text-center text-xs text-slate-500">
      分かったら口頭で答える。正解の確定は出題者が行う
    </p>

    {consumptions !== undefined && <ConsumptionNotice consumptions={consumptions} />}
  </section>
);
