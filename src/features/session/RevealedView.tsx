import { DifficultyBadge } from "../../components/DifficultyBadge";
import { PrimaryButton } from "../../components/buttons";
import type { RoundAward } from "../../domain/score";
import type { Player, SessionAction } from "../../domain/session";
import type { Topic } from "../../domain/topic";

export const RevealedView = ({
  topic,
  award,
  consumptions,
  presenter,
  answerer,
  isLastRound,
  canAdvance,
  dispatch,
}: {
  topic: Topic;
  award: RoundAward;
  consumptions: number;
  presenter?: Player;
  answerer?: Player;
  isLastRound: boolean;
  /** Design 7.1 gives this to the host as well, so the game never waits on one person. */
  canAdvance: boolean;
  dispatch: (action: SessionAction) => void;
}) => (
  <section className="flex flex-col gap-6">
    <div className="flex flex-col items-center gap-4 rounded-3xl border border-slate-800 bg-slate-900/60 px-4 py-8">
      <p className="text-xs tracking-[0.2em] text-slate-500">正解</p>
      <DifficultyBadge difficulty={topic.difficulty} />
      <p className="text-center text-4xl font-black break-all text-slate-50">{topic.word}</p>
      <p className="text-xs text-slate-500">{topic.category}</p>
    </div>

    <ul className="divide-y divide-slate-800 rounded-2xl border border-slate-800 bg-slate-900/60">
      <li className="flex items-center justify-between px-4 py-3">
        <span className="text-sm text-slate-300">
          出題 {presenter?.name}
          <span className="ml-2 text-xs text-slate-500">
            難易度 {topic.difficulty}・お助けと引き直し {consumptions} 回
          </span>
        </span>
        <span className="text-lg font-bold text-slate-100">+{award.presenter}</span>
      </li>
      <li className="flex items-center justify-between px-4 py-3">
        <span className="text-sm text-slate-300">正解 {answerer?.name}</span>
        <span className="text-lg font-bold text-slate-100">+{award.answerer}</span>
      </li>
    </ul>

    {canAdvance ? (
      <PrimaryButton onClick={() => dispatch({ type: "next" })}>
        {isLastRound ? "結果を見る" : "次の出題へ"}
      </PrimaryButton>
    ) : (
      <p className="text-center text-xs text-slate-500">出題者かホストが次に進めるのを待っている</p>
    )}
  </section>
);
