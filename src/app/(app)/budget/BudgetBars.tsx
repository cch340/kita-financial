import { MoneyText } from '@/components/ui/MoneyText'

/**
 * Horizontal rounded bar split into a peach (JC) segment and a blue (CH) segment,
 * each sized as its share of the category total. Guards against divide-by-zero
 * when totalCents is 0 (no budget set for the category yet).
 */
export function SplitBar({
  jcCents,
  chCents,
  totalCents,
}: {
  jcCents: number
  chCents: number
  totalCents: number
}) {
  const jcPct = totalCents > 0 ? (jcCents / totalCents) * 100 : 0
  const chPct = totalCents > 0 ? (chCents / totalCents) * 100 : 0

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[var(--subtle)]">
        <div className="h-full" style={{ width: `${jcPct}%`, background: 'var(--peach)' }} />
        <div className="h-full" style={{ width: `${chPct}%`, background: 'var(--member-jc)' }} />
      </div>
      <div className="flex items-center gap-3 text-xs font-semibold text-[var(--muted)]">
        <span>
          JC <MoneyText cents={jcCents} />
        </span>
        <span>
          CH <MoneyText cents={chCents} />
        </span>
      </div>
    </div>
  )
}

/**
 * Budget-vs-actual bar: fill width is spend as a fraction of the category
 * budget, capped at 100% so overspend doesn't overflow the track. Guards
 * against divide-by-zero when totalCents is 0. Colored sage (under/at budget)
 * or amber (over budget).
 */
export function ActualBar({ spentCents, totalCents }: { spentCents: number; totalCents: number }) {
  const fraction = totalCents > 0 ? Math.min(1, spentCents / totalCents) : 0
  const pct = totalCents > 0 ? Math.round((spentCents / totalCents) * 100) : 0
  const overBudget = spentCents > totalCents
  const bg = overBudget ? 'var(--pending-bg)' : 'var(--positive-bg)'
  const fg = overBudget ? 'var(--pending-text)' : 'var(--positive-text)'

  return (
    <div className="flex flex-col gap-1.5">
      <div className="h-2.5 w-full overflow-hidden rounded-full" style={{ background: bg }}>
        <div className="h-full rounded-full" style={{ width: `${fraction * 100}%`, background: fg }} />
      </div>
      <p className="text-xs font-semibold text-[var(--muted)]">
        <MoneyText cents={spentCents} className="font-bold text-[var(--ink-head)]" /> · {pct}%
      </p>
    </div>
  )
}
