import { monthShort } from '@/lib/data/summary'

/**
 * A compact 12-column CSS bar chart (Jan..Dec). Heights scale to `maxValue`.
 * When `signed`, negative values render red with a ▼ caret and positive values a ▲ caret
 * above the bar, so sign is legible without relying on color. Pure presentational Server Component; no chart lib.
 */
export function MonthBars({
  values,
  maxValue,
  locale,
  signed = false,
}: {
  values: number[]
  maxValue: number
  locale: 'en' | 'zh'
  signed?: boolean
}) {
  return (
    <div className="flex items-end gap-[3px]" aria-hidden="true">
      {values.map((v, i) => {
        const pct = maxValue > 0 ? Math.round((Math.abs(v) / maxValue) * 100) : 0
        const bg = signed && v < 0 ? 'var(--danger)' : 'var(--primary)'
        return (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            {signed && (
              <span className="text-[8px] leading-none" style={{ color: bg }}>
                {v > 0 ? '▲' : v < 0 ? '▼' : ''}
              </span>
            )}
            <div className="flex h-16 w-full items-end">
              <div
                className="w-full rounded-[3px]"
                style={{ height: `${pct}%`, minHeight: v !== 0 ? 2 : 0, background: bg }}
              />
            </div>
            <span className="text-[9px] font-semibold text-[var(--faint)]">
              {monthShort(i + 1, locale).replace('月', '')}
            </span>
          </div>
        )
      })}
    </div>
  )
}
