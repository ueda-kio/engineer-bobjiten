import { settleRound } from "../../domain/score";
import type { Difficulty } from "../../domain/topic";

export const ResetNotice = ({ difficulties }: { difficulties: Difficulty[] }) => (
  <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-center text-xs leading-5 text-amber-200">
    難易度 {difficulties.join("・")}{" "}
    の語が一巡したため、その難易度の出題済み記録をリセットした。既に出た語が再び出ることがある
  </p>
);

/**
 * What this round is currently worth to the presenter.
 *
 * The count of helps used is not what anyone wants to know; what they want is
 * how many points are left to win, so that showing 1 says plainly that another
 * help buys nothing. Once it reaches the floor, saying so is what makes holding
 * out an obvious choice rather than a guess.
 */
export const RoundScoreNotice = ({
  difficulty,
  consumptions,
}: {
  difficulty: Difficulty;
  consumptions: number;
}) => {
  const { presenter } = settleRound({ difficulty, consumptions });

  return (
    <p className="text-center text-xs text-slate-500">
      この出題の得点: <span className="font-bold text-slate-300">{presenter}点</span>
      {presenter === 0 && <span className="ml-1">（これ以上は減りません）</span>}
    </p>
  );
};
