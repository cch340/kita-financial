import Link from 'next/link'
import { getBudget } from '@/lib/data/budget'
import { getMembership } from '@/lib/data/household'
import { formatMonthYear } from '@/lib/data/summary'
import { t } from '@/i18n'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { MoneyText } from '@/components/ui/MoneyText'
import { SplitBar, ActualBar } from './BudgetBars'

export default async function BudgetPage() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  const [budget, membership] = await Promise.all([getBudget(year, month), getMembership()])
  const locale = membership?.language ?? 'en'
  const monthLabel = formatMonthYear(year, month, locale)

  const { overall, categories, commitments } = budget
  const overallProgress = overall.totalCents > 0 ? overall.spentCents / overall.totalCents : 0
  const overallLeftCents = overall.totalCents - overall.spentCents
  const commitmentsTotalCents = commitments.reduce((a, c) => a + c.amountCents, 0)

  return (
    <div className="flex flex-col gap-[15px] pb-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-[var(--ink-head)]">{t(locale, 'budget.title')}</h1>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[var(--subtle)] px-3 py-1 text-xs font-bold text-[var(--muted)]">
            {monthLabel}
          </span>
          <Link
            href="/budget/manage"
            className="pressable rounded-full bg-[var(--primary-btn)] px-3 py-1 text-xs font-bold text-white"
          >
            {t(locale, 'budget.manage')}
          </Link>
        </div>
      </header>

      <Card>
        <div className="flex items-baseline gap-1.5">
          <MoneyText cents={overall.spentCents} className="text-[28px] font-extrabold text-[var(--ink-head)]" />
          <span className="flex items-center gap-1 text-sm font-semibold text-[var(--muted)]">
            {t(locale, 'budget.of')} <MoneyText cents={overall.totalCents} />
          </span>
        </div>
        <div className="mt-3">
          <ProgressBar value={overallProgress} />
        </div>
        <p className="mt-2 text-sm font-semibold text-[var(--muted)]">
          <MoneyText cents={overallLeftCents} className="font-bold text-[var(--ink-head)]" /> {t(locale, 'budget.left')}
        </p>
      </Card>

      {categories.map((cat, i) => {
        const name = locale === 'zh' && cat.nameZh ? cat.nameZh : cat.nameEn
        return (
          <Card key={i} className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-base font-bold text-[var(--ink-head)]">{name}</span>
              <MoneyText cents={cat.totalCents} className="text-sm font-bold text-[var(--ink-head)]" />
            </div>
            <SplitBar jcCents={cat.jcCents} chCents={cat.chCents} totalCents={cat.totalCents} />
            <ActualBar spentCents={cat.spentCents} totalCents={cat.totalCents} />
          </Card>
        )
      })}

      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-[var(--hairline)] px-4 py-3">
          <span className="text-sm font-bold text-[var(--ink-head)]">{t(locale, 'budget.commitments')}</span>
          <span className="flex items-center gap-1 text-sm font-semibold text-[var(--muted)]">
            {t(locale, 'budget.total')} <MoneyText cents={commitmentsTotalCents} className="font-bold text-[var(--ink-head)]" />
          </span>
        </div>
        {commitments.map((c, i) => {
          const name = locale === 'zh' && c.nameZh ? c.nameZh : c.nameEn
          return (
            <div
              key={i}
              className={`flex items-center justify-between px-4 py-3 ${
                i < commitments.length - 1 ? 'border-b border-[var(--hairline)]' : ''
              }`}
            >
              <span className="text-sm font-semibold text-[var(--ink-head)]">{name}</span>
              <MoneyText cents={c.amountCents} className="text-sm font-bold text-[var(--ink-head)]" />
            </div>
          )
        })}
      </Card>
    </div>
  )
}
