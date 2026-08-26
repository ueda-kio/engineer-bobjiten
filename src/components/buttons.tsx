type ButtonProps = {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
};

export const PrimaryButton = ({ children, onClick, disabled = false }: ButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="w-full rounded-2xl bg-indigo-500 px-6 py-4 text-lg font-bold text-white shadow-lg shadow-indigo-500/20 transition active:scale-[0.98] enabled:hover:bg-indigo-400 disabled:opacity-40 disabled:shadow-none"
  >
    {children}
  </button>
);

export const SecondaryButton = ({ children, onClick, disabled = false }: ButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="w-full rounded-2xl border border-slate-700 px-6 py-4 font-bold text-slate-200 transition active:scale-[0.98] enabled:hover:border-slate-500 disabled:opacity-40"
  >
    {children}
  </button>
);
