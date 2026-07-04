'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useT, useLocale } from '@/i18n/LocaleProvider'
import { formatRM, pushDigit, pushDoubleZero, backspace } from '@/lib/money'
import { CATEGORIES, categoryLabel, type CategoryKey } from '@/lib/categories'
import { MemberAvatar } from '@/components/ui/MemberAvatar'
import { addExpenseAction } from './actions'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', '⌫'] as const
const MEMBERS = ['CH', 'JC'] as const

export function AddExpenseForm({ error }: { error?: string }) {
  const t = useT()
  const locale = useLocale()
  const [cents, setCents] = useState(0)
  const [payer, setPayer] = useState<'CH' | 'JC' | null>(null)
  const [category, setCategory] = useState<CategoryKey | null>(null)
  const [note, setNote] = useState('')

  function pressKey(key: (typeof KEYS)[number]) {
    if (key === '⌫') {
      setCents((c) => backspace(c))
      return
    }
    if (key === '00') {
      setCents((c) => pushDoubleZero(c))
      return
    }
    setCents((c) => pushDigit(c, Number(key)))
  }

  const todayISO = new Date().toISOString().slice(0, 10)

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[var(--paper)]">
      <div className="mx-auto flex min-h-full max-w-[430px] flex-col px-[18px] pb-6 pt-4">
        {/* header */}
        <div className="flex items-center justify-between py-2">
          <Link
            href="/expenses"
            aria-label={t('common.back')}
            className="grid h-11 w-11 place-items-center text-2xl text-[var(--muted)]"
          >
            ‹
          </Link>
          <h1 className="text-base font-bold text-[var(--ink-head)]">{t('add.title')}</h1>
          <Link
            href="/expenses"
            aria-label={t('common.close')}
            className="grid h-11 w-11 place-items-center text-2xl text-[var(--muted)]"
          >
            ×
          </Link>
        </div>

        {/* amount */}
        <div className="flex flex-col items-center gap-1 py-8">
          <span className="text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">
            {t('add.amount')}
          </span>
          <div className="flex items-center text-[44px] leading-none font-extrabold text-[var(--ink-head)]">
            {formatRM(cents)}
            <span className="ml-1 inline-block h-9 w-[3px] animate-pulse bg-[var(--primary)]" />
          </div>
        </div>

        <form action={addExpenseAction} className="flex flex-1 flex-col gap-5">
          <input type="hidden" name="amountCents" value={cents} />
          <input type="hidden" name="category" value={category ?? ''} />
          <input type="hidden" name="paidBy" value={payer ?? ''} />
          <input type="hidden" name="note" value={note} />
          <input type="hidden" name="dateISO" value={todayISO} />

          {/* who paid */}
          <div>
            <p className="mb-2 text-sm font-semibold text-[var(--muted)]">{t('add.whoPaid')}</p>
            <div className="flex gap-2">
              {MEMBERS.map((m) => {
                const selected = payer === m
                const memberColor = m === 'CH' ? 'var(--member-ch)' : 'var(--member-jc)'
                return (
                  <button
                    type="button"
                    key={m}
                    onClick={() => setPayer((p) => (p === m ? null : m))}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 font-semibold"
                    style={{
                      borderColor: selected ? memberColor : 'var(--hairline)',
                      background: selected ? memberColor : 'var(--surface)',
                      color: selected ? 'white' : 'var(--ink)',
                    }}
                  >
                    <MemberAvatar member={m} size={24} />
                    {m}
                  </button>
                )
              })}
            </div>
          </div>

          {/* category chips */}
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => {
              const selected = category === c.key
              return (
                <button
                  type="button"
                  key={c.key}
                  onClick={() => setCategory((cur) => (cur === c.key ? null : c.key))}
                  className="rounded-full border px-4 py-2 text-sm font-semibold whitespace-nowrap"
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

          {/* note */}
          <div className="flex items-center gap-2 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('add.note')}
              className="flex-1 bg-transparent text-sm text-[var(--ink)] outline-none placeholder:text-[var(--faint)]"
            />
            <span className="shrink-0 rounded-full bg-[var(--subtle)] px-3 py-1 text-xs font-semibold text-[var(--muted)]">
              {t('add.today')}
            </span>
          </div>

          {error && (
            <p className="text-sm font-semibold text-[var(--danger)]">{t(`error.${error}`)}</p>
          )}

          {/* spacer pushes the keypad + save button to the bottom */}
          <div className="flex-1" />

          {/* numeric keypad */}
          <div className="grid grid-cols-3 gap-2">
            {KEYS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => pressKey(k)}
                className="rounded-xl bg-[var(--surface)] text-lg font-semibold text-[var(--ink)]"
                style={{ height: 50 }}
              >
                {k}
              </button>
            ))}
          </div>

          <button
            type="submit"
            disabled={cents <= 0}
            className="w-full rounded-xl bg-[var(--primary-btn)] py-3.5 font-bold text-white disabled:opacity-40"
          >
            {t('add.save')}
          </button>
        </form>
      </div>
    </div>
  )
}
