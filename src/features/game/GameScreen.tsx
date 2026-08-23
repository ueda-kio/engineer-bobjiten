import { TOPICS } from "../../data/topics";
import type { Difficulty, Topic } from "../../domain/topic";
import { useGame } from "./useGame";

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  1: "かんたん",
  2: "ふつう",
  3: "むずかしい",
};

const DIFFICULTY_STYLE: Record<Difficulty, string> = {
  1: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  2: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  3: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
};

const DifficultyBadge = ({ difficulty }: { difficulty: Difficulty }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ring-1 ${
      DIFFICULTY_STYLE[difficulty]
    }`}
  >
    {"★".repeat(difficulty)} {DIFFICULTY_LABEL[difficulty]}
  </span>
);

const PrimaryButton = ({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full rounded-2xl bg-indigo-500 px-6 py-4 text-lg font-bold text-white shadow-lg shadow-indigo-500/20 transition active:scale-[0.98] hover:bg-indigo-400"
  >
    {children}
  </button>
);

const HelperButton = ({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="w-full rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3 text-sm font-semibold text-slate-200 transition active:scale-[0.98] enabled:hover:border-slate-500 disabled:opacity-40"
  >
    {children}
  </button>
);

const STEPS = [
  "難易度1〜3から1つずつ、計3つのお題を引く",
  "その中から1つ選んで出題する",
  "説明が難しければ引き直せる（パス券）",
];

const CandidateCard = ({ topic, onSelect }: { topic: Topic; onSelect: () => void }) => (
  <button
    type="button"
    onClick={onSelect}
    className="flex w-full flex-col items-start gap-2 rounded-2xl border border-slate-700 bg-slate-800/60 p-4 text-left transition active:scale-[0.98] hover:border-indigo-400"
  >
    <DifficultyBadge difficulty={topic.difficulty} />
    <span className="text-2xl font-bold break-all text-slate-50">{topic.word}</span>
  </button>
);

export const GameScreen = () => {
  const { state, draw, redraw, select, revealCategory, revealWhitelist } = useGame(TOPICS);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-5 py-8">
      <header className="text-center">
        <h1 className="text-3xl font-black tracking-tight text-slate-50">
          エンジニア縛りボブジテン
        </h1>
      </header>

      {state.phase === "idle" && (
        <section className="flex flex-1 flex-col justify-center gap-8">
          <div className="rounded-3xl border border-indigo-500/40 bg-indigo-500/10 px-5 py-7 text-center">
            <p className="text-xs font-bold tracking-[0.2em] text-indigo-300">きほんのルール</p>
            <p className="mt-3 text-2xl leading-snug font-black text-slate-50">
              カタカナ・英語を
              <br />
              使わずに説明する
            </p>
            <p className="mt-3 text-sm text-slate-300">お題の文字数は言ってもよい</p>
          </div>

          <div>
            <h2 className="text-xs font-bold tracking-[0.2em] text-slate-500">あそびかた</h2>
            <ol className="mt-3 space-y-3">
              {STEPS.map((step, index) => (
                <li key={step} className="flex items-start gap-3">
                  <span className="mt-px flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-slate-300 ring-1 ring-slate-700">
                    {index + 1}
                  </span>
                  <span className="text-sm leading-6 text-slate-300">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <PrimaryButton onClick={draw}>お題を引く</PrimaryButton>
        </section>
      )}

      {state.phase === "picking" && (
        <section className="flex flex-1 flex-col gap-4">
          <p className="text-center text-sm text-slate-400">出題するお題を1つ選ぶ</p>
          <div className="flex flex-col gap-3">
            {state.candidates.map((topic) => (
              <CandidateCard key={topic.id} topic={topic} onSelect={() => select(topic)} />
            ))}
          </div>
          <button
            type="button"
            onClick={redraw}
            className="mt-auto w-full rounded-xl px-4 py-3 text-sm font-semibold text-slate-400 underline-offset-4 hover:underline"
          >
            引き直す
          </button>
        </section>
      )}

      {state.phase === "presenting" && (
        <section className="flex flex-1 flex-col gap-6">
          <div className="flex flex-col items-center gap-4 rounded-3xl border border-slate-800 bg-slate-900/60 px-4 py-10">
            <DifficultyBadge difficulty={state.topic.difficulty} />
            <p className="text-center text-4xl font-black break-all text-slate-50">
              {state.topic.word}
            </p>
            <p className="text-sm text-slate-400">{state.topic.word.length} 文字</p>
          </div>

          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <HelperButton onClick={revealCategory} disabled={state.categoryRevealed}>
                カテゴリを見る
              </HelperButton>
              <HelperButton onClick={revealWhitelist} disabled={state.whitelistRevealed}>
                ホワイトリストを見る
              </HelperButton>
            </div>

            {state.categoryRevealed && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <p className="text-xs text-slate-500">カテゴリ</p>
                <p className="mt-1 font-bold text-slate-100">{state.topic.category}</p>
              </div>
            )}

            {state.whitelistRevealed && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <p className="text-xs text-slate-500">この語は使ってよい</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {state.topic.relatedWords.map((word) => (
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

            <p className="rounded-xl border border-dashed border-slate-700 p-3 text-center text-xs text-slate-400">
              ワン・カタカナ使用可能（自己申告制）
            </p>
          </div>

          <button
            type="button"
            onClick={redraw}
            className="mt-auto w-full rounded-2xl border border-slate-700 px-6 py-4 font-bold text-slate-200 transition active:scale-[0.98] hover:border-slate-500"
          >
            引き直す（パス券）
          </button>
        </section>
      )}
    </div>
  );
};
