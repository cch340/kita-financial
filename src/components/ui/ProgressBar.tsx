export function ProgressBar({
  value,
  trackClassName = '',
  barClassName = '',
}: {
  value: number
  trackClassName?: string
  barClassName?: string
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  return (
    <div
      className={`h-2 w-full overflow-hidden rounded-full bg-[var(--subtle)] ${trackClassName}`}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full bg-[var(--primary)] ${barClassName}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
