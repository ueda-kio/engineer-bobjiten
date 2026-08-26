import type { Difficulty } from "../domain/topic";

const LABEL: Record<Difficulty, string> = {
  1: "かんたん",
  2: "ふつう",
  3: "むずかしい",
};

const STYLE: Record<Difficulty, string> = {
  1: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  2: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  3: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
};

export const DifficultyBadge = ({ difficulty }: { difficulty: Difficulty }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ring-1 ${STYLE[difficulty]}`}
  >
    {"★".repeat(difficulty)} {LABEL[difficulty]}
  </span>
);
