import { MoneyText } from '@/components/ui/MoneyText'

/**
 * Horizontal rounded bar split into a JC segment and a CH segment, each sized as
 * its share of the category total. Member colors follow the app-wide convention
 * (CH = peach `--member-ch`, JC = blue `--member-jc`) so the split matches the
 * avatars and payer toggle elsewhere. Guards against divide-by-zero when
 * totalCents is 0 (no budget set for the category yet).
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
        <div className="h-full" style={{ width: `${jcPct}%`, background: 'var(--member-jc)' }} />
        <div className="h-full" style={{ width: `${chPct}%`, background: 'var(--member-ch)' }} />
      </div>
      <div className="flex items-center gap-3 text-xs font-semibold text-[var(--muted)]">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: 'var(--member-jc)' }} />
          JC <MoneyText cents={jcCents} />
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: 'var(--member-ch)' }} />
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
