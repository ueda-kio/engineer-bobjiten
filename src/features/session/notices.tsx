import type { Difficulty } from "../../domain/topic";

export const ResetNotice = ({ difficulties }: { difficulties: Difficulty[] }) => (
  <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-center text-xs leading-5 text-amber-200">
    難易度 {difficulties.join("・")}{" "}
    の語が一巡したため、その難易度の出題済み記録をリセットした。既に出た語が再び出ることがある
  </p>
);

/** Shows how much the presenter has already spent this turn. */
export const ConsumptionNotice = ({ consumptions }: { consumptions: number }) => (
  <p className="text-center text-xs text-slate-500">
    この出題での消費: <span className="font-bold text-slate-300">{consumptions}</span>
  </p>
);
