'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useT, useLocale } from '@/i18n/LocaleProvider'
import { formatRM, parseMoneyInput } from '@/lib/money'
import { CATEGORIES, categoryLabel, type CategoryKey } from '@/lib/categories'
import { MemberAvatar } from '@/components/ui/MemberAvatar'
import { SubmitButton } from '@/components/ui/SubmitButton'
import type { ExpenseRow } from '@/lib/data/types'
import { updateExpenseAction } from '../../actions'

const MEMBERS = ['CH', 'JC'] as const

export function EditExpenseForm({ row, error }: { row: ExpenseRow; error?: string }) {
  const t = useT()
  const locale = useLocale()
  const [amount, setAmount] = useState((row.amount_cents / 100).toFixed(2))
  const [payer, setPayer] = useState<'CH' | 'JC' | null>(row.paid_by)
  const [category, setCategory] = useState<CategoryKey | null>((row.category as CategoryKey | null) ?? null)
  const [note, setNote] = useState(row.details ?? '')
  const [vendor, setVendor] = useState(row.vendor ?? '')
  const [location, setLocation] = useState(row.location ?? '')
  const [date, setDate] = useState(row.date)

  const cents = parseMoneyInput(amount)

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[var(--paper)]">
      <div className="mx-auto flex min-h-full max-w-[430px] flex-col px-[18px] pb-6 pt-4">
        <div className="flex items-center justify-between py-2">
          <Link
            href="/expenses"
            aria-label={t('common.back')}
            className="pressable-opacity grid h-11 w-11 place-items-center text-2xl text-[var(--muted)]"
          >
            ‹
          </Link>
          <h1 className="text-base font-bold text-[var(--ink-head)]">{t('edit.title')}</h1>
          <Link
            href="/expenses"
            aria-label={t('common.close')}
            className="pressable-opacity grid h-11 w-11 place-items-center text-2xl text-[var(--muted)]"
          >
            ×
          </Link>
        </div>

        <div className="flex flex-col items-center gap-1 py-6">
          <span className="text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">{t('add.amount')}</span>
          <div className="text-[36px] leading-none font-extrabold text-[var(--ink-head)]">{formatRM(cents)}</div>
        </div>

        <form action={updateExpenseAction} className="flex flex-1 flex-col gap-5">
          <input type="hidden" name="id" value={row.id} />
          <input type="hidden" name="amountCents" value={cents} />
          <input type="hidden" name="category" value={category ?? ''} />
          <input type="hidden" name="paidBy" value={payer ?? ''} />
          <input type="hidden" name="note" value={note} />
          <input type="hidden" name="dateISO" value={date} />
          <input type="hidden" name="vendor" value={vendor} />
          <input type="hidden" name="location" value={location} />

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-[var(--muted)]">{t('add.amount')}</span>
            <div className="flex items-center gap-2 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3">
              <span className="text-sm font-semibold text-[var(--muted)]">RM</span>
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="flex-1 bg-transparent text-base text-[var(--ink)] outline-none placeholder:text-[var(--faint)]"
              />
            </div>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-[var(--muted)]">{t('add.date')}</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--ink)] outline-none"
            />
          </label>

          <div>
            <p className="mb-2 text-sm font-semibold text-[var(--muted)]">{t('add.whoPaid')}</p>
            <div className="flex gap-2">
              {MEMBERS.map((mem) => {
                const selected = payer === mem
                const memberColor = mem === 'CH' ? 'var(--member-ch)' : 'var(--member-jc)'
                return (
                  <button
                    type="button"
                    key={mem}
                    onClick={() => setPayer((p) => (p === mem ? null : mem))}
                    className="pressable flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 font-semibold"
                    style={{
                      borderColor: selected ? memberColor : 'var(--hairline)',
                      background: selected ? memberColor : 'var(--surface)',
                      color: selected ? 'white' : 'var(--ink)',
                    }}
                  >
                    <MemberAvatar member={mem} size={24} />
                    {mem}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => {
              const selected = category === c.key
              return (
                <button
                  type="button"
                  key={c.key}
                  onClick={() => setCategory((cur) => (cur === c.key ? null : c.key))}
                  className="pressable flex min-h-[44px] items-center rounded-full border px-4 py-2.5 text-sm font-semibold whitespace-nowrap"
                  style={{
                    borderColor: selected ? 'var(--primary)' : 'var(--hairline)',
                    background: selected ? 'var(--primary)' : 'var(--surface)',
                    color: selected ? 'white' : 'var(--ink)',
                  }}
                >
                  {categoryLabel(c.key, locale)}
                </button>
              )
            })}
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-[var(--muted)]">{t('add.vendor')}</span>
            <input
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              className="w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--ink)] outline-none placeholder:text-[var(--faint)]"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-[var(--muted)]">{t('add.location')}</span>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--ink)] outline-none placeholder:text-[var(--faint)]"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-[var(--muted)]">{t('add.note')}</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--ink)] outline-none placeholder:text-[var(--faint)]"
            />
          </label>

          {error && <p className="text-sm font-semibold text-[var(--danger)]">{t(`error.${error}`)}</p>}

          <div className="flex-1" />

          <SubmitButton
            disabled={cents <= 0}
            className="w-full rounded-xl bg-[var(--primary-btn)] py-3.5 font-bold text-white disabled:opacity-40"
          >
            {t('edit.saveChanges')}
          </SubmitButton>
        </form>
      </div>
    </div>
  )
}
