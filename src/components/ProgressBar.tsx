type Props = {
  value: number | null;
  label: string;
  /** Shown instead of the bar when value is null. */
  emptyText?: string;
};

export function ProgressBar({ value, label, emptyText = "아직 할 일 없음" }: Props) {
  if (value === null) {
    return <p className="text-sm text-slate-500" aria-label={label}>{emptyText}</p>;
  }
  return (
    <div className="flex items-center gap-3">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200"
      >
        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${value}%` }} />
      </div>
      <span className="w-12 text-right text-sm font-semibold tabular-nums">{value}%</span>
    </div>
  );
}
