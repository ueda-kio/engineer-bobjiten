export const ResetNotice = () => (
  <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-center text-xs leading-5 text-amber-200">
    お題が一巡したため、出題済みの記録をリセットした。既に出た語が再び出ることがある
  </p>
);

/** Shows how much the presenter has already spent this turn. */
export const ConsumptionNotice = ({ consumptions }: { consumptions: number }) => (
  <p className="text-center text-xs text-slate-500">
    この出題での消費: <span className="font-bold text-slate-300">{consumptions}</span>
  </p>
);
