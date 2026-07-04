'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useT, useLocale } from '@/i18n/LocaleProvider'
import { formatMonthYear } from '@/lib/data/summary'
import type { LedgerEntry } from '@/lib/data/personal-shared'
import { Card, HeroCard } from '@/components/ui/Card'
import { MoneyText } from '@/components/ui/MoneyText'
import { addLedgerEntry } from './actions'

type Member = 'CH' | 'JC'
type Ledger = {
  income: LedgerEntry[]
  expenses: LedgerEntry[]
  incomeCents: number
  expensesCents: number
  balanceCents: number
  availableMonths: string[]
}

type Props = {
  member: Member
  year: number
  month: number
  ledger: Ledger
}

const MEMBERS: Member[] = ['CH', 'JC']

function toCents(v: string): number {
  const n = parseFloat(v || '0')
  return Number.isFinite(n) ? Math.round(n * 100) : 0 // guard NaN from non-numeric input
}

const pad = (n: number) => String(n).padStart(2, '0')

export function PersonalView({ member, year, month, ledger }: Props) {
  const t = useT()
  const locale = useLocale()
  const router = useRouter()

  const monthLabel = formatMonthYear(year, month, locale)
  const isEmpty = ledger.income.length === 0 && ledger.expenses.length === 0

  function goTo(nextMember: Member, y: number, m: number) {
    router.push(`/personal?member=${nextMember}&y=${y}&m=${m}`)
  }

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
    goTo(member, y, m)
  }

  return (
    <div className="flex flex-col gap-5 pb-6">
      <header className="flex items-center gap-3">
        <Link
          href="/"
          aria-label={t('common.back')}
          className="grid h-11 w-11 shrink-0 place-items-center text-2xl text-[var(--muted)]"
        >
          ‹
        </Link>
        <h1 className="flex-1 truncate text-xl font-extrabold text-[var(--ink-head)]">{t('personal.title')}</h1>
      </header>

      {/* CH / JC segmented switch */}
      <div className="flex gap-2">
        {MEMBERS.map((m) => {
          const selected = member === m
          const memberColor = m === 'CH' ? 'var(--member-ch)' : 'var(--member-jc)'
          return (
            <button
              type="button"
              key={m}
              onClick={() => goTo(m, year, month)}
              className="min-h-[44px] flex-1 rounded-xl border py-2.5 text-sm font-bold"
              style={{
                borderColor: selected ? memberColor : 'var(--hairline)',
                background: selected ? memberColor : 'var(--surface)',
                color: selected ? 'white' : 'var(--ink)',
              }}
            >
              {m}
            </button>
          )
        })}
      </div>

      {/* month stepper */}
      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          aria-label={t('expenses.prevMonth')}
          onClick={() => goMonth(-1)}
          className="grid h-11 w-11 place-items-center rounded-full text-xl text-[var(--muted)]"
        >
          ‹
        </button>
        <span className="min-w-[150px] text-center text-sm font-bold text-[var(--ink-head)]">{monthLabel}</span>
        <button
          type="button"
          aria-label={t('expenses.nextMonth')}
          onClick={() => goMonth(1)}
          className="grid h-11 w-11 place-items-center rounded-full text-xl text-[var(--muted)]"
        >
          ›
        </button>
      </div>

      {isEmpty ? (
        <p className="py-10 text-center text-sm font-semibold text-[var(--faint)]">{t('personal.empty')}</p>
      ) : (
        <>
          <LedgerCard
            title={t('personal.income')}
            rows={ledger.income}
            totalCents={ledger.incomeCents}
            totalClassName="text-[var(--positive-text)]"
          />
          <LedgerCard
            title={t('personal.expenses')}
            rows={ledger.expenses}
            totalCents={ledger.expensesCents}
            totalClassName="text-[var(--primary)]"
          />
        </>
      )}

      <HeroCard>
        <span className="text-sm font-bold opacity-90">{t('personal.balance')}</span>
        <div className="mt-1">
          <MoneyText cents={ledger.balanceCents} className="text-[32px] font-extrabold" />
        </div>
      </HeroCard>

      <AddEntry member={member} periodISO={`${year}-${pad(month)}-01`} />
    </div>
  )
}

function LedgerCard({
  title,
  rows,
  totalCents,
  totalClassName,
}: {
  title: string
  rows: LedgerEntry[]
  totalCents: number
  totalClassName: string
}) {
  return (
    <Card className="flex flex-col gap-3">
      <span className="text-sm font-bold text-[var(--ink-head)]">{title}</span>
      {rows.length > 0 && (
        <div className="flex flex-col gap-2">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[var(--ink)]">{r.description}</p>
                {r.remark && <p className="truncate text-xs text-[var(--muted)]">{r.remark}</p>}
              </div>
              <MoneyText cents={r.amountCents} className="shrink-0 text-sm font-bold text-[var(--ink-head)]" />
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between border-t border-[var(--hairline)] pt-3">
        <span className="text-xs font-semibold text-[var(--muted)]">{title}</span>
        <MoneyText cents={totalCents} className={`text-sm font-extrabold ${totalClassName}`} />
      </div>
    </Card>
  )
}

function AddEntry({ member, periodISO }: { member: Member; periodISO: string }) {
  const t = useT()
  const router = useRouter()

  const [open, setOpen] = useState(false)
  const [entryType, setEntryType] = useState<'income' | 'expense'>('expense')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cents = toCents(amount)
  const canSubmit = cents > 0 && description.trim().length > 0 && !submitting

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    const res = await addLedgerEntry({
      member,
      period: periodISO,
      entryType,
      description: description.trim(),
      amountCents: cents,
    })
    setSubmitting(false)
    if (!res.ok) {
      setError(res.error ?? 'save_failed')
      return
    }
    setEntryType('expense')
    setDescription('')
    setAmount('')
    setOpen(false)
    router.refresh()
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-[44px] w-full rounded-xl border border-dashed border-[var(--primary)] py-3 text-sm font-bold text-[var(--primary)]"
      >
        ＋ {t('personal.addEntry')}
      </button>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-[16px] border border-[var(--hairline)] bg-[var(--surface)] p-4"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-[var(--ink-head)]">{t('personal.addEntry')}</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label={t('common.close')}
          className="grid h-11 w-11 place-items-center text-xl text-[var(--muted)]"
        >
          ×
        </button>
      </div>

      <div className="flex gap-2">
        {(['income', 'expense'] as const).map((ty) => {
          const selected = entryType === ty
          const color = ty === 'income' ? 'var(--positive-text)' : 'var(--primary)'
          return (
            <button
              key={ty}
              type="button"
              onClick={() => setEntryType(ty)}
              className="min-h-[44px] flex-1 rounded-xl border py-2.5 text-sm font-semibold"
              style={{
                borderColor: selected ? color : 'var(--hairline)',
                background: selected ? color : 'var(--surface)',
                color: selected ? 'white' : 'var(--ink)',
              }}
            >
              {t(ty === 'income' ? 'personal.income' : 'personal.expenses')}
            </button>
          )
        })}
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-[var(--muted)]">{t('asset.form.description')}</span>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--faint)]"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-[var(--muted)]">{t('asset.form.amount')}</span>
        <div className="flex items-center gap-2 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3">
          <span className="text-sm font-semibold text-[var(--muted)]">RM</span>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="flex-1 bg-transparent text-sm text-[var(--ink)] outline-none placeholder:text-[var(--faint)]"
          />
        </div>
      </label>

      {error && (
        <p role="alert" className="text-sm font-semibold text-[var(--danger)]">
          {t(`error.${error}`)}
        </p>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="min-h-[44px] w-full rounded-xl bg-[var(--primary-btn)] py-3 text-sm font-bold text-white disabled:opacity-40"
      >
        {t('asset.form.save')}
      </button>
    </form>
  )
}
