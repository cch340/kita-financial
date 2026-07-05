'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Pencil } from 'lucide-react'
import { useT } from '@/i18n/LocaleProvider'
import { monthShort } from '@/lib/data/summary'
import { collapseLeadingPaid } from '@/lib/data/fund-shared'
import type { FundOverview, MemberCell } from '@/lib/data/fund-shared'
import { Card, HeroCard } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { MemberAvatar } from '@/components/ui/MemberAvatar'
import { MoneyText } from '@/components/ui/MoneyText'
import { Spinner } from '@/components/ui/Spinner'
import type { FundConfig } from '@/lib/data/fund'
import { FundConfigEditor } from './FundConfigEditor'
import { toggleContributionPaid } from './actions'

type Locale = 'en' | 'zh'
type Member = 'CH' | 'JC'

type Props = {
  overview: FundOverview
  locale: Locale
  month: number
  config: FundConfig
}

export function FundView({ overview, locale, month, config }: Props) {
  const t = useT()
  const router = useRouter()
  const [error, setError] = useState(false)
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [editingConfig, setEditingConfig] = useState(false)

  const progress = overview.yearExpectedCents > 0 ? overview.yearContributedCents / overview.yearExpectedCents : 0
  const { CH, JC } = overview.expectedEachCents
  const { summary, rest } = collapseLeadingPaid(overview.months)

  async function handleToggle(member: Member, periodISO: string) {
    const key = `${member}-${periodISO}`
    if (pendingKey) return
    setError(false)
    setPendingKey(key)
    const res = await toggleContributionPaid(member, periodISO)
    if (!res.ok) {
      setError(true)
      setPendingKey(null)
      return
    }
    router.refresh()
    setPendingKey(null)
  }

  return (
    <div className="flex flex-col gap-5 pb-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-[var(--ink-head)]">{t('fund.title')}</h1>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[var(--subtle)] px-3 py-1 text-xs font-bold text-[var(--muted)]">
            {overview.year}
          </span>
          <button
            type="button"
            onClick={() => setEditingConfig((v) => !v)}
            aria-label={t('fund.editConfig')}
            aria-expanded={editingConfig}
            className="pressable-opacity grid h-11 w-11 place-items-center rounded-full text-[var(--muted)]"
          >
            <Pencil size={16} />
          </button>
        </div>
      </header>

      {editingConfig && <FundConfigEditor config={config} onClose={() => setEditingConfig(false)} />}

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-[var(--pending-bg)] px-4 py-2 text-sm font-semibold text-[var(--danger)]"
        >
          {t('error.save_failed')}
        </p>
      )}

      <HeroCard>
        <span className="text-sm font-bold opacity-90">{t('fund.contributed')}</span>
        <div className="mt-1">
          <MoneyText cents={overview.yearContributedCents} className="text-[32px] font-extrabold" />
        </div>
        <p className="mt-1 flex items-center gap-1 text-sm font-semibold opacity-80">
          <MoneyText cents={overview.yearExpectedCents} /> {t('fund.ofYear')}
        </p>
        <div className="mt-3">
          <ProgressBar value={progress} trackClassName="bg-white/25" barClassName="bg-white" />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <div className="flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold whitespace-nowrap">
            <span>{t('fund.carryForward')}</span>
            <span>·</span>
            <MoneyText cents={overview.carryForwardCents} />
          </div>
          <div className="flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold whitespace-nowrap">
            {CH === JC ? (
              <>
                <MoneyText cents={CH} /> <span>{t('fund.perMonthEach')}</span>
              </>
            ) : (
              <>
                <MoneyText cents={CH} /> <span>/</span> <MoneyText cents={JC} /> <span>{t('fund.perMonthEach')}</span>
              </>
            )}
          </div>
        </div>
      </HeroCard>

      <Card className="overflow-hidden p-0">
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-[var(--hairline)] px-4 py-3">
          <span />
          <MemberAvatar member="CH" size={32} />
          <MemberAvatar member="JC" size={32} />
        </div>

        {summary && (
          <div className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-[var(--hairline)] px-4 py-3">
            <span className="text-sm font-semibold text-[var(--muted)]">
              {monthShort(1, locale)}–{monthShort(summary.throughMonth, locale)} · {t('fund.allPaid')}
            </span>
            <MoneyText cents={summary.totalCents} className="text-sm font-bold text-[var(--ink-head)]" />
          </div>
        )}

        {rest.map((m, i) => {
          const isCurrent = m.month === month
          return (
            <div
              key={m.month}
              className={`grid grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-3 ${
                i < rest.length - 1 ? 'border-b border-[var(--hairline)]' : ''
              } ${isCurrent ? 'bg-[var(--subtle)]' : ''}`}
            >
              <span className="text-sm font-bold text-[var(--ink-head)]">{monthShort(m.month, locale)}</span>
              <FundCell
                cell={m.ch}
                member="CH"
                periodISO={m.periodISO}
                isCurrent={isCurrent}
                pending={pendingKey === `CH-${m.periodISO}`}
                onToggle={handleToggle}
                t={t}
              />
              <FundCell
                cell={m.jc}
                member="JC"
                periodISO={m.periodISO}
                isCurrent={isCurrent}
                pending={pendingKey === `JC-${m.periodISO}`}
                onToggle={handleToggle}
                t={t}
              />
            </div>
          )
        })}
      </Card>
    </div>
  )
}

function FundCell({
  cell,
  member,
  periodISO,
  isCurrent,
  pending,
  onToggle,
  t,
}: {
  cell: MemberCell
  member: Member
  periodISO: string
  isCurrent: boolean
  pending: boolean
  onToggle: (member: Member, periodISO: string) => void
  t: (key: string) => string
}) {
  if (cell == null) {
    return <span className="grid h-11 min-w-11 place-items-center text-sm text-[var(--faint)]">—</span>
  }

  if (cell.status === 'paid') {
    return (
      <span
        className="inline-flex min-h-11 items-center justify-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap"
        style={{ background: 'var(--positive-bg)', color: 'var(--positive-text)' }}
      >
        <Check size={12} strokeWidth={3} />
        <MoneyText cents={cell.amountCents} />
      </span>
    )
  }

  // pending
  if (isCurrent) {
    return (
      <button
        type="button"
        onClick={() => onToggle(member, periodISO)}
        disabled={pending}
        aria-busy={pending}
        className="pressable inline-flex min-h-11 min-w-11 items-center justify-center rounded-full px-3 py-2 text-xs font-bold whitespace-nowrap text-white"
        style={{ background: 'var(--primary)' }}
      >
        {pending ? <Spinner size={12} /> : t('fund.markPaid')}
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={() => onToggle(member, periodISO)}
      disabled={pending}
      aria-busy={pending}
      className="pressable inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap"
      style={{ background: 'var(--pending-bg)', color: 'var(--pending-text)' }}
    >
      {pending ? (
        <Spinner size={12} />
      ) : (
        <>
          <MoneyText cents={cell.amountCents} />
          <span>{t('status.pending')}</span>
        </>
      )}
    </button>
  )
}
