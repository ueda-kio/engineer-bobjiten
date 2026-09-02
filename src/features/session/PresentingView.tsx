import { DifficultyBadge } from "../../components/DifficultyBadge";
import { settleRound } from "../../domain/score";
import type { HelpKind, Player, RevealedHelps, SessionAction } from "../../domain/session";
import type { Topic } from "../../domain/topic";
import { RoundScoreNotice } from "./notices";

const HELPS: { kind: HelpKind; label: string; note: string }[] = [
  { kind: "category", label: "カテゴリを見る", note: "−1点 / 分野を明かす" },
  { kind: "whitelist", label: "ホワイトリスト", note: "−1点 / 使える語が増える" },
  { kind: "oneKatakana", label: "ワン・カタカナ", note: "−1点 / カタカナを1つ" },
];

export const PresentingView = ({
  presenter,
  others,
  topic,
  consumptions,
  revealedHelps,
  dispatch,
}: {
  presenter: Player;
  others: Player[];
  topic: Topic;
  consumptions: number;
  revealedHelps: RevealedHelps;
  dispatch: (action: SessionAction) => void;
}) => {
  const award = settleRound({ difficulty: topic.difficulty, consumptions });

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-4 rounded-3xl border border-slate-800 bg-slate-900/60 px-4 py-8">
        <p className="text-xs text-slate-500">
          出題者 <span className="font-bold text-slate-300">{presenter.name}</span>
        </p>
        <DifficultyBadge difficulty={topic.difficulty} />
        <p className="text-center text-4xl font-black break-all text-slate-50">{topic.word}</p>
        <p className="text-sm text-slate-400">{topic.word.length} 文字</p>
      </div>

      <p className="text-center text-xs leading-5 text-slate-400">
        カタカナ・英語、およびお題を日本語に訳した語は使えない
      </p>

      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-xs font-bold tracking-[0.2em] text-slate-500">
            説明に詰まったときのお助け機能
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            1つ使うごとに、この出題で自分が得る点が1下がる。回答者の得点は変わらない
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {HELPS.map(({ kind, label, note }) => (
            <button
              key={kind}
              type="button"
              onClick={() => dispatch({ type: "useHelp", kind })}
              disabled={revealedHelps[kind]}
              className="flex flex-col items-center gap-1 rounded-xl border border-slate-700 bg-slate-800/60 px-2 py-3 transition active:scale-[0.98] enabled:hover:border-slate-500 disabled:opacity-40"
            >
              <span className="text-xs font-semibold text-slate-200">{label}</span>
              <span className="text-[10px] leading-4 text-slate-400">{note}</span>
            </button>
          ))}
        </div>

        {revealedHelps.category && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-xs text-slate-500">カテゴリ</p>
            <p className="mt-1 font-bold text-slate-100">{topic.category}</p>
          </div>
        )}

        {revealedHelps.whitelist && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-xs text-slate-500">この語は使ってよい</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {topic.relatedWords.map((word) => (
                <li
                  key={word}
                  className="rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-100"
                >
                  {word}
                </li>
              ))}
            </ul>
          </div>
        )}

        {revealedHelps.oneKatakana && (
          <p className="rounded-xl border border-dashed border-slate-700 p-3 text-center text-xs leading-5 text-slate-400">
            「〇〇を使います」と宣言して、カタカナ語を1つだけ使える
          </p>
        )}
      </div>

      <RoundScoreNotice difficulty={topic.difficulty} consumptions={consumptions} />

      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-bold tracking-[0.2em] text-slate-500">
          正解者（出題者 +{award.presenter} / 正解者 +{award.answerer}）
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {others.map((player) => (
            <button
              key={player.id}
              type="button"
              onClick={() => dispatch({ type: "confirmAnswerer", playerId: player.id })}
              className="rounded-xl bg-indigo-500 px-3 py-3 text-sm font-bold text-white transition active:scale-[0.98] hover:bg-indigo-400"
            >
              {player.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-bold tracking-[0.2em] text-slate-500">
          カタカナ使用を指摘した人（+1）
        </h2>
        <p className="text-xs leading-5 text-slate-400">
          出題者が違反を認めた場合のみ押す。出題者は減点されない
        </p>
        <div className="grid grid-cols-2 gap-2">
          {others.map((player) => (
            <button
              key={player.id}
              type="button"
              onClick={() => dispatch({ type: "acceptKatakanaReport", reporterId: player.id })}
              className="rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2.5 text-sm text-slate-200 transition active:scale-[0.98] hover:border-slate-500"
            >
              {player.name}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => dispatch({ type: "redraw" })}
        className="w-full rounded-2xl border border-slate-700 px-6 py-4 font-bold text-slate-200 transition active:scale-[0.98] hover:border-slate-500"
      >
        引き直す（−1点・出題者は交代しない）
      </button>
    </section>
  );
};
