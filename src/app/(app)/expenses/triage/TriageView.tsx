'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useT, useLocale } from '@/i18n/LocaleProvider'
import type { CatalogItem } from '@/lib/data/catalog-shared'
import { MemberAvatar } from '@/components/ui/MemberAvatar'
import { MoneyText } from '@/components/ui/MoneyText'
import { Spinner } from '@/components/ui/Spinner'
import type { ExpenseRow } from '@/lib/data/types'
import { setExpenseTriageAction } from './actions'

const MEMBERS = ['CH', 'JC'] as const

export function TriageView({ items, categories }: { items: ExpenseRow[]; categories: CatalogItem[] }) {
  const t = useT()
  const [index, setIndex] = useState(0)
  const total = items.length
  const current = items[index]

  function next() {
    setIndex((i) => i + 1)
  }

  if (!current) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <div className="text-5xl">🎉</div>
        <h1 className="text-2xl font-extrabold text-[var(--ink-head)]">{t('triage.done')}</h1>
        <p className="max-w-[280px] text-sm font-semibold text-[var(--muted)]">{t('triage.doneDesc')}</p>
        <Link
          href="/expenses"
          className="pressable mt-2 flex min-h-[44px] items-center rounded-xl bg-[var(--primary-btn)] px-6 font-bold text-white"
        >
          {t('triage.backToExpenses')}
        </Link>
      </div>
    )
  }

  const pct = Math.round((index / total) * 100)

  return (
    <div className="flex flex-col gap-5 pb-6">
      {/* header + progress */}
      <div className="flex items-center justify-between py-2">
        <Link
          href="/expenses"
          aria-label={t('common.close')}
          className="pressable-opacity grid h-11 w-11 place-items-center text-2xl text-[var(--muted)]"
        >
          ×
        </Link>
        <h1 className="text-base font-bold text-[var(--ink-head)]">{t('triage.title')}</h1>
        <span className="min-w-11 text-right text-sm font-bold text-[var(--muted)]">
          {index + 1} {t('triage.of')} {total}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--subtle)]">
        <div className="h-full rounded-full bg-[var(--primary)] transition-[width] duration-200" style={{ width: `${pct}%` }} />
      </div>

      <TriageCard key={current.id} row={current} categories={categories} onResolved={next} onSkip={next} />
    </div>
  )
}

function TriageCard({
  row,
  categories,
  onResolved,
  onSkip,
}: {
  row: ExpenseRow
  categories: CatalogItem[]
  onResolved: () => void
  onSkip: () => void
}) {
  const t = useT()
  const locale = useLocale()
  const [category, setCategory] = useState<string | null>(row.category_id)
  const [payer, setPayer] = useState<'CH' | 'JC' | null>(row.paid_by)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)

  const dateLabel = new Date(row.date).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  const title = row.vendor_name || row.details || dateLabel

  async function confirm() {
    if (!category || !payer) return
    setSaving(true)
    setFailed(false)
    const res = await setExpenseTriageAction(row.id, category, payer)
    if (!res.ok) {
      setSaving(false)
      setFailed(true)
      return
    }
    onResolved()
  }

  return (
    <div className="flex flex-col gap-5">
      {/* read-only expense summary */}
      <div className="flex flex-col gap-2 rounded-[16px] bg-[var(--surface)] p-4 shadow-[0_3px_10px_oklch(0.5_0.05_45/.05)]">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 flex-1 truncate text-base font-bold text-[var(--ink)]">{title}</p>
          <MoneyText cents={row.amount_cents} className="shrink-0 text-lg font-extrabold text-[var(--ink-head)]" />
        </div>
        <p className="text-xs font-semibold text-[var(--muted)]">{dateLabel}</p>
        {row.details && row.details !== title && (
          <p className="truncate text-xs text-[var(--muted)]">{row.details}</p>
        )}
        {row.location_name && <p className="truncate text-xs text-[var(--faint)]">{row.location_name}</p>}
      </div>

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
                onClick={() => setPayer(m)}
                className="pressable flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 font-semibold"
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

      {/* category */}
      <div>
        <p className="mb-2 text-sm font-semibold text-[var(--muted)]">{t('triage.category')}</p>
        {categories.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            {t('triage.noCategories')}{' '}
            <Link href="/expenses" className="font-semibold text-[var(--primary)] underline">
              {t('nav.expenses')}
            </Link>
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => {
              const selected = category === c.id
              return (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  className="pressable flex min-h-[44px] items-center rounded-full border px-4 py-2.5 text-sm font-semibold whitespace-nowrap"
                  style={{
                    borderColor: selected ? 'var(--primary)' : 'var(--hairline)',
                    background: selected ? 'var(--primary)' : 'var(--surface)',
                    color: selected ? 'white' : 'var(--ink)',
                  }}
                >
                  {c.name}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {failed && <p className="text-sm font-semibold text-[var(--danger)]">{t('error.save_failed')}</p>}

      {/* actions */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onSkip}
          disabled={saving}
          className="pressable flex min-h-[44px] items-center justify-center rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-6 font-bold text-[var(--muted)] disabled:opacity-40"
        >
          {t('triage.skip')}
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={saving || !category || !payer}
          aria-busy={saving}
          className="pressable relative flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-[var(--primary-btn)] font-bold text-white disabled:opacity-40"
        >
          <span className="transition-opacity" style={{ opacity: saving ? 0 : 1 }}>
            {t('triage.saveNext')}
          </span>
          {saving && (
            <span className="absolute inset-0 flex items-center justify-center">
              <Spinner />
            </span>
          )}
        </button>
      </div>
    </div>
  )
}
