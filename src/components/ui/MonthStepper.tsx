'use client'
import { useRouter } from 'next/navigation'
import { useT, useLocale } from '@/i18n/LocaleProvider'
import { formatMonthYear } from '@/lib/data/summary'

/** Prev / label / next month control. Pushes `${basePath}?y=<year>&m=<month>`.
 *  Matches the inline steppers on Expenses and Personal for visual consistency. */
export function MonthStepper({ year, month, basePath }: { year: number; month: number; basePath: string }) {
  const t = useT()
  const locale = useLocale()
  const router = useRouter()

  function goMonth(delta: number) {
    let m = month + delta
    let y = year
    if (m < 1) {
      m = 12
      y -= 1
    } else if (m > 12) {
      m = 1
      y += 1
    }
    router.push(`${basePath}?y=${y}&m=${m}`)
  }

  return (
    <div className="flex items-center justify-center gap-4">
      <button
        type="button"
        aria-label={t('expenses.prevMonth')}
        onClick={() => goMonth(-1)}
        className="pressable-opacity grid h-11 w-11 place-items-center rounded-full text-xl text-[var(--muted)]"
      >
        ‹
      </button>
      <span className="min-w-[150px] text-center text-sm font-bold text-[var(--ink-head)]">
        {formatMonthYear(year, month, locale)}
      </span>
      <button
        type="button"
        aria-label={t('expenses.nextMonth')}
        onClick={() => goMonth(1)}
        className="pressable-opacity grid h-11 w-11 place-items-center rounded-full text-xl text-[var(--muted)]"
      >
        ›
      </button>
    </div>
  )
}
