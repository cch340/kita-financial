import Link from 'next/link'
import { ChevronLeft, Download } from 'lucide-react'
import { t } from '@/i18n'
import { categoryLabel } from '@/lib/categories'
import type { YearReport } from '@/lib/data/report'
import { Card, HeroCard } from '@/components/ui/Card'
import { MoneyText } from '@/components/ui/MoneyText'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { MemberAvatar } from '@/components/ui/MemberAvatar'
import { MonthBars } from './MonthBars'

type Locale = 'en' | 'zh'

export function ReportView({ report, locale }: { report: YearReport; locale: Locale }) {
  const { year, matrix, fund, personalTrend, availableYears } = report
  const fundProgress = fund.yearExpectedCents > 0 ? fund.yearContributedCents / fund.yearExpectedCents : 0
  const monthMax = Math.max(0, ...matrix.monthTotals)
  const trendMax = Math.max(
    0,
    ...personalTrend.CH.map((v) => Math.abs(v)),
    ...personalTrend.JC.map((v) => Math.abs(v)),
  )
  const hasData = matrix.grandTotalCents > 0 || fund.yearContributedCents > 0
  const exportHref = (params: string) => `/report/export?${params}`

  return (
    <div className="flex flex-col gap-5 pb-6">
      <header className="flex items-center gap-1">
        <Link
          href="/"
          aria-label={t(locale, 'common.back')}
          className="pressable-opacity -ml-2 grid h-11 w-11 place-items-center text-[var(--muted)]"
        >
          <ChevronLeft size={24} />
        </Link>
        <h1 className="text-2xl font-extrabold text-[var(--ink-head)]">{t(locale, 'report.title')}</h1>
      </header>

      {/* Year selector — plain links, no client JS */}
      <div className="flex flex-wrap gap-2">
        {availableYears.map((y) => {
          const active = y === year
          return (
            <Link
              key={y}
              href={`/report?y=${y}`}
              className="pressable-opacity min-h-11 rounded-full px-4 py-2 text-sm font-bold"
              style={{
                background: active ? 'var(--primary)' : 'var(--subtle)',
                color: active ? 'white' : 'var(--muted)',
              }}
            >
              {y}
            </Link>
          )
        })}
      </div>

      {!hasData && (
        <Card>
          <p className="text-sm font-semibold text-[var(--muted)]">{t(locale, 'report.noData')}</p>
        </Card>
      )}

      {/* Joint fund year summary */}
      <HeroCard>
        <span className="text-sm font-bold opacity-90">{t(locale, 'report.fundSummary')}</span>
        <div className="mt-1">
          <MoneyText cents={fund.yearContributedCents} className="text-[32px] font-extrabold" />
        </div>
        <p className="mt-1 flex items-center gap-1 text-sm font-semibold opacity-80">
          <MoneyText cents={fund.yearExpectedCents} /> {t(locale, 'report.ofYear')}
        </p>
        <div className="mt-3">
          <ProgressBar value={fundProgress} trackClassName="bg-white/25" barClassName="bg-white" />
        </div>
        <div className="mt-4 flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold whitespace-nowrap">
          <span>{t(locale, 'report.carryForward')}</span>
          <span>·</span>
          <MoneyText cents={fund.carryForwardCents} />
        </div>
      </HeroCard>

      {/* Spending by month */}
      <Card>
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-[var(--ink-head)]">{t(locale, 'report.spendingByMonth')}</span>
          <MoneyText cents={matrix.grandTotalCents} className="text-sm font-bold text-[var(--ink-head)]" />
        </div>
        <div className="mt-3">
          <MonthBars values={matrix.monthTotals} maxValue={monthMax} locale={locale} />
        </div>
      </Card>

      {/* By category */}
      <Card>
        <span className="text-sm font-bold text-[var(--ink-head)]">{t(locale, 'report.byCategory')}</span>
        {matrix.categories.length === 0 ? (
          <p className="mt-2 text-sm font-semibold text-[var(--muted)]">{t(locale, 'report.noData')}</p>
        ) : (
          <div className="mt-3 flex flex-col gap-4">
            {matrix.categories.map((key) => (
              <div key={key} className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold text-[var(--ink)]">{categoryLabel(key, locale)}</span>
                  <MoneyText cents={matrix.categoryTotals[key]} className="font-bold text-[var(--ink-head)]" />
                </div>
                <MonthBars values={matrix.cells[key]} maxValue={monthMax} locale={locale} />
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Personal balance trend per member */}
      <Card>
        <span className="text-sm font-bold text-[var(--ink-head)]">{t(locale, 'report.personalBalance')}</span>
        <div className="mt-3 flex flex-col gap-5">
          {(['CH', 'JC'] as const).map((member) => (
            <div key={member} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <MemberAvatar member={member} size={24} />
                <span className="text-sm font-bold text-[var(--ink)]">{member}</span>
              </div>
              <MonthBars values={personalTrend[member]} maxValue={trendMax} locale={locale} signed />
            </div>
          ))}
        </div>
      </Card>

      {/* Export (per domain) */}
      <Card>
        <div className="flex items-center gap-2">
          <Download size={16} className="text-[var(--muted)]" />
          <span className="text-sm font-bold text-[var(--ink-head)]">{t(locale, 'report.export')}</span>
        </div>
        <p className="mt-1 text-xs font-semibold text-[var(--muted)]">{t(locale, 'report.exportNote')}</p>
        <div className="mt-3 flex flex-col gap-2">
          <ExportLink href={exportHref(`type=expenses&year=${year}`)} label={`${t(locale, 'report.downloadExpenses')} · ${year}`} />
          <ExportLink href={exportHref(`type=ledger&year=${year}&member=CH`)} label={`${t(locale, 'report.downloadLedger')} · CH ${year}`} />
          <ExportLink href={exportHref(`type=ledger&year=${year}&member=JC`)} label={`${t(locale, 'report.downloadLedger')} · JC ${year}`} />
        </div>
      </Card>
    </div>
  )
}

function ExportLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      download
      className="pressable flex min-h-[44px] items-center justify-between gap-2 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-2.5 text-sm font-bold text-[var(--ink)]"
    >
      <span>{label}</span>
      <Download size={16} className="text-[var(--muted)]" />
    </a>
  )
}
