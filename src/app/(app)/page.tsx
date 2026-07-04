import Link from 'next/link'
import { SlidersHorizontal } from 'lucide-react'
import { getMembership } from '@/lib/data/household'
import { getHomeSummary } from '@/lib/data/home'
import { t } from '@/i18n'
import { Card, HeroCard } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { MemberAvatar } from '@/components/ui/MemberAvatar'
import { IconTile } from '@/components/ui/IconTile'
import { StatusChip } from '@/components/ui/StatusChip'
import { MoneyText } from '@/components/ui/MoneyText'
import { Fab } from '@/components/ui/Fab'

export default async function HomePage() {
  const [membership, summary] = await Promise.all([getMembership(), getHomeSummary()])
  const locale = membership?.language ?? 'en'
  const memberCode = membership?.memberCode ?? 'CH'
  const displayName = membership?.displayName ?? ''

  const jointFundProgress =
    summary.jointFund.expectedThisMonthCents > 0
      ? summary.jointFund.contributedCents / summary.jointFund.expectedThisMonthCents
      : 0
  const budgetProgress = summary.budget.totalCents > 0 ? summary.budget.spentCents / summary.budget.totalCents : 0
  const budgetLeftCents = summary.budget.totalCents - summary.budget.spentCents

  return (
    <div className="flex flex-col gap-[15px] pb-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-[var(--ink-head)]">
            {t(locale, 'home.greeting.morning')}, {displayName}
          </h1>
          <p className="mt-0.5 text-sm font-semibold text-[var(--muted)]">{summary.monthLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/settings"
            aria-label={t(locale, 'settings.title')}
            className="grid h-11 w-11 place-items-center rounded-full text-[var(--muted)]"
          >
            <SlidersHorizontal size={20} strokeWidth={2} />
          </Link>
          <MemberAvatar member={memberCode} />
        </div>
      </header>

      <HeroCard>
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold opacity-90">{t(locale, 'home.jointFund')}</span>
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">{summary.monthLabel}</span>
        </div>
        <div className="mt-3 flex items-baseline gap-1.5">
          <MoneyText cents={summary.jointFund.contributedCents} className="text-[32px] font-extrabold" />
          <span className="flex items-center gap-1 text-sm font-semibold opacity-80">
            / <MoneyText cents={summary.jointFund.expectedThisMonthCents} />
          </span>
        </div>
        <div className="mt-3">
          <ProgressBar value={jointFundProgress} trackClassName="bg-white/25" barClassName="bg-white" />
        </div>
        <div className="mt-4 flex gap-2">
          <div className="flex items-center gap-1.5 rounded-full bg-white/15 py-1 pr-1 pl-3 text-xs font-bold">
            <span>CH</span>
            <StatusChip status={summary.jointFund.chPaid ? 'paid' : 'pending'} />
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-white/15 py-1 pr-1 pl-3 text-xs font-bold">
            <span>JC</span>
            <StatusChip status={summary.jointFund.jcPaid ? 'paid' : 'pending'} />
          </div>
        </div>
      </HeroCard>

      <Card>
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-[var(--ink-head)]">{t(locale, 'home.budget')}</span>
          <span className="text-xs font-semibold text-[var(--positive-text)]">{t(locale, 'home.onTrack')}</span>
        </div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <MoneyText cents={budgetLeftCents} className="text-2xl font-extrabold text-[var(--ink-head)]" />
          <span className="text-sm font-semibold text-[var(--muted)]">{t(locale, 'home.left')}</span>
        </div>
        <div className="mt-3">
          <ProgressBar value={budgetProgress} />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs font-semibold text-[var(--muted)]">
          <span className="flex items-center gap-1">
            <MoneyText cents={summary.budget.spentCents} /> {t(locale, 'home.spent')}
          </span>
          <MoneyText cents={summary.budget.totalCents} />
        </div>
      </Card>

      <Card className="flex items-center gap-3">
        <div className="flex -space-x-3">
          <MemberAvatar member="CH" size={36} />
          <MemberAvatar member="JC" size={36} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-[var(--ink-head)]">{t(locale, 'home.personalLedgers')}</p>
          <p className="truncate text-xs text-[var(--muted)]">{t(locale, 'home.personalLedgers.subtitle')}</p>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-[var(--ink-head)]">{t(locale, 'home.upcoming')}</span>
          <span className="text-xs font-semibold text-[var(--primary)]">{t(locale, 'home.viewAll')}</span>
        </div>
        {summary.upcoming.length > 0 && (
          <div className="mt-3 flex flex-col gap-3">
            {summary.upcoming.map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <IconTile name={item.icon} tint="var(--subtle)" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-[var(--ink)]">{item.title}</p>
                  <p className="truncate text-xs text-[var(--muted)]">{item.due}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <MoneyText cents={item.amountCents} className="text-sm font-bold text-[var(--ink-head)]" />
                  <StatusChip status={item.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Fab href="/expenses/add" label={t(locale, 'add.title')} />
    </div>
  )
}
