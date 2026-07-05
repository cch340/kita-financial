'use client'
import { useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useT, useLocale } from '@/i18n/LocaleProvider'
import { CATEGORIES, categoryLabel } from '@/lib/categories'
import { groupByDay, formatMonthYear } from '@/lib/data/summary'
import type { ExpenseRow } from '@/lib/data/types'
import { IconTile } from '@/components/ui/IconTile'
import { MoneyText } from '@/components/ui/MoneyText'
import { Fab } from '@/components/ui/Fab'
import { Spinner } from '@/components/ui/Spinner'
import { deleteExpenseAction } from './actions'

type Props = {
  rows: ExpenseRow[]
  totalCents: number
  year: number
  month: number
  todayISO: string
  triageCount: number
}

const REVEAL_WIDTH = 152 // px — two 76px action buttons behind each row

export function ExpensesView({ rows, totalCents, year, month, todayISO, triageCount }: Props) {
  const t = useT()
  const locale = useLocale()
  const router = useRouter()
  const [selected, setSelected] = useState<string | null>(null) // null = "All"
  const [deleteFailed, setDeleteFailed] = useState(false)
  const monthLabel = formatMonthYear(year, month, locale)

  const presentCategoryKeys = useMemo(() => {
    const present = new Set(rows.map((r) => r.category ?? 'uncategorized'))
    const ordered = CATEGORIES.filter((c) => present.has(c.key)).map((c) => c.key as string)
    if (present.has('uncategorized')) ordered.push('uncategorized')
    return ordered
  }, [rows])

  const filteredRows = selected == null ? rows : rows.filter((r) => (r.category ?? 'uncategorized') === selected)
  const groups = groupByDay(filteredRows, todayISO)

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
    router.push(`/expenses?y=${y}&m=${m}`)
  }

  return (
    <div className="flex flex-col gap-5 pb-6">
      <h1 className="text-2xl font-extrabold text-[var(--ink-head)]">{t('expenses.title')}</h1>

      {triageCount > 0 && (
        <Link
          href="/expenses/triage"
          className="pressable flex min-h-[44px] items-center justify-between gap-2 rounded-full bg-[var(--pending-bg)] px-4 py-2.5 text-sm font-bold text-[var(--pending-text)]"
        >
          <span>
            {triageCount} {t('triage.needSorting')}
          </span>
          <span aria-hidden className="text-base">›</span>
        </Link>
      )}

      {deleteFailed && (
        <p
          role="alert"
          className="rounded-xl bg-[var(--pending-bg)] px-4 py-2 text-sm font-semibold text-[var(--danger)]"
        >
          {t('error.delete_failed')}
        </p>
      )}

      {/* month stepper */}
      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          aria-label={t('expenses.prevMonth')}
          onClick={() => goMonth(-1)}
          className="pressable-opacity grid h-11 w-11 place-items-center rounded-full text-xl text-[var(--muted)]"
        >
          ‹
        </button>
        <span className="min-w-[150px] text-center text-sm font-bold text-[var(--ink-head)]">{monthLabel}</span>
        <button
          type="button"
          aria-label={t('expenses.nextMonth')}
          onClick={() => goMonth(1)}
          className="pressable-opacity grid h-11 w-11 place-items-center rounded-full text-xl text-[var(--muted)]"
        >
          ›
        </button>
      </div>

      {/* running total for the selected month */}
      <div className="flex flex-col items-center gap-1 py-2">
        <MoneyText cents={totalCents} className="text-[36px] font-extrabold text-[var(--ink-head)]" />
        <span className="text-sm font-semibold text-[var(--muted)]">{t('expenses.spentThisMonth')}</span>
      </div>

      {/* filter chips */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="pressable flex min-h-[44px] items-center rounded-full border px-4 py-2.5 text-sm font-semibold whitespace-nowrap"
          style={{
            borderColor: selected == null ? 'var(--primary)' : 'var(--hairline)',
            background: selected == null ? 'var(--primary)' : 'var(--surface)',
            color: selected == null ? 'white' : 'var(--ink)',
          }}
        >
          {t('expenses.all')}
        </button>
        {presentCategoryKeys.map((key) => {
          const active = selected === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelected((cur) => (cur === key ? null : key))}
              className="pressable flex min-h-[44px] items-center rounded-full border px-4 py-2.5 text-sm font-semibold whitespace-nowrap"
              style={{
                borderColor: active ? 'var(--primary)' : 'var(--hairline)',
                background: active ? 'var(--primary)' : 'var(--surface)',
                color: active ? 'white' : 'var(--ink)',
              }}
            >
              {categoryLabel(key === 'uncategorized' ? null : key, locale)}
            </button>
          )
        })}
      </div>

      {/* date-grouped list */}
      {groups.length === 0 ? (
        <p className="py-10 text-center text-sm font-semibold text-[var(--faint)]">{t('expenses.empty')}</p>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((g) => (
            <div key={g.date} className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-sm font-bold text-[var(--ink-head)]">
                  {g.label === 'Today' ? t('common.today') : g.label === 'Yesterday' ? t('common.yesterday') : g.label}
                </span>
                <MoneyText cents={g.totalCents} className="text-sm font-bold text-[var(--muted)]" />
              </div>
              <div className="flex flex-col gap-2">
                {g.rows.map((r) => (
                  <ExpenseRowCard key={r.id} row={r} locale={locale} t={t} onDeleteError={() => setDeleteFailed(true)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Fab href="/expenses/add" />
    </div>
  )
}

function ExpenseRowCard({
  row,
  locale,
  t,
  onDeleteError,
}: {
  row: ExpenseRow
  locale: 'en' | 'zh'
  t: (key: string) => string
  onDeleteError: () => void
}) {
  const router = useRouter()
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const dragState = useRef<{ startX: number; startDragX: number } | null>(null)

  const cat = CATEGORIES.find((c) => c.key === row.category)
  const iconName = cat?.icon ?? 'Tag'
  const tint = cat?.tint ?? 'var(--subtle)'
  // Fall back to the category label (not the page title) when a row has no vendor/note.
  const title = row.vendor || row.details || categoryLabel(row.category, locale)
  const subParts = [categoryLabel(row.category, locale), row.paid_by].filter((p): p is string => Boolean(p))

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    dragState.current = { startX: e.clientX, startDragX: dragX }
    setDragging(true)
  }
  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const ds = dragState.current
    if (!ds) return
    const delta = e.clientX - ds.startX
    const next = Math.min(0, Math.max(-REVEAL_WIDTH, ds.startDragX + delta))
    setDragX(next)
  }
  function onPointerUp() {
    if (!dragState.current) return
    dragState.current = null
    setDragging(false)
    setDragX((x) => (x < -REVEAL_WIDTH / 2 ? -REVEAL_WIDTH : 0))
  }

  return (
    <div className="relative overflow-hidden rounded-[16px]">
      {/* revealed actions, sit behind the row */}
      <div className="absolute inset-y-0 right-0 flex" style={{ width: REVEAL_WIDTH }}>
        <button
          type="button"
          onClick={() => router.push(`/expenses/edit/${row.id}`)}
          className="pressable-opacity flex h-full flex-1 items-center justify-center text-sm font-bold text-white"
          style={{ background: 'var(--pending-text)' }}
        >
          {t('expenses.edit')}
        </button>
        <button
          type="button"
          disabled={deleting}
          onClick={async () => {
            setDeleting(true)
            const res = await deleteExpenseAction(row.id)
            if (!res.ok) {
              setDeleting(false)
              onDeleteError()
            }
          }}
          className="pressable-opacity flex h-full flex-1 items-center justify-center text-sm font-bold text-white"
          style={{ background: 'var(--danger)' }}
        >
          {deleting ? <Spinner /> : t('expenses.delete')}
        </button>
      </div>

      {/* foreground row — drag horizontally to reveal actions */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative flex touch-pan-y items-center gap-3 rounded-[16px] bg-[var(--surface)] p-3 shadow-[0_3px_10px_oklch(0.5_0.05_45/.05)]"
        style={{ transform: `translateX(${dragX}px)`, transition: dragging ? 'none' : 'transform 160ms ease' }}
      >
        <IconTile name={iconName} tint={tint} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-[var(--ink)]">{title}</p>
          <p className="truncate text-xs text-[var(--muted)]">{subParts.join(' · ')}</p>
        </div>
        <MoneyText cents={row.amount_cents} className="shrink-0 text-sm font-bold text-[var(--ink-head)]" />
      </div>
    </div>
  )
}
