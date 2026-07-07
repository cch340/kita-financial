'use client'
import { useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { SlidersHorizontal } from 'lucide-react'
import { useT, useLocale } from '@/i18n/LocaleProvider'
import { groupByDay, formatMonthYear } from '@/lib/data/summary'
import type { ExpenseRow } from '@/lib/data/types'
import type { CatalogItem } from '@/lib/data/catalog-shared'
import { IconTile } from '@/components/ui/IconTile'
import { MemberAvatar } from '@/components/ui/MemberAvatar'
import { MoneyText } from '@/components/ui/MoneyText'
import { Fab } from '@/components/ui/Fab'
import { Spinner } from '@/components/ui/Spinner'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { TRIAGE_ENABLED } from '@/lib/features'
import { deleteExpenseAction } from './actions'
import { FilterSheet, type Filters, type FilterValue } from './FilterSheet'
import { ManageSheet } from './ManageSheet'
import { ExpenseDetailSheet } from './ExpenseDetailSheet'

type Props = {
  rows: ExpenseRow[]
  totalCents: number
  year: number
  month: number
  todayISO: string
  triageCount: number
  categories: CatalogItem[]
  vendors: CatalogItem[]
  locations: CatalogItem[]
}

const REVEAL_WIDTH = 152 // px — two 76px action buttons behind each row

export function ExpensesView({
  rows, totalCents, year, month, todayISO, triageCount, categories, vendors, locations,
}: Props) {
  const t = useT()
  const locale = useLocale()
  const router = useRouter()
  const [deleteFailed, setDeleteFailed] = useState(false)
  const monthLabel = formatMonthYear(year, month, locale)

  const [filters, setFilters] = useState<Filters>({ categoryId: null, vendorId: null, locationId: null })
  const [sheetOpen, setSheetOpen] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  const activeCount = [filters.categoryId, filters.vendorId, filters.locationId].filter((v) => v !== null).length

  const matchField = (rowId: string | null, f: FilterValue) =>
    f === null ? true : f === 'other' ? rowId === null : rowId === f
  const filteredRows = rows.filter((r) =>
    matchField(r.category_id, filters.categoryId) &&
    matchField(r.vendor_id, filters.vendorId) &&
    matchField(r.location_id, filters.locationId))
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
    // pb-28 clears the fixed FAB (bottom-[100px], h-14) so the last rows scroll past it.
    <div className="flex flex-col gap-5 pb-28">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-[var(--ink-head)]">{t('expenses.title')}</h1>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setSheetOpen(true)}
            className="pressable-opacity flex min-h-[40px] items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-3 text-sm font-bold text-[var(--ink)]">
            <SlidersHorizontal size={16} />
            {t('expenses.filter')}{activeCount > 0 ? ` · ${activeCount}` : ''}
          </button>
          <button type="button" onClick={() => setManageOpen(true)}
            className="pressable-opacity flex min-h-[40px] items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-3 text-sm font-bold text-[var(--ink)]">
            <SlidersHorizontal size={16} />
            {t('common.manage')}
          </button>
        </div>
      </div>

      {TRIAGE_ENABLED && triageCount > 0 && (
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
                  <ExpenseRowCard key={r.id} row={r} t={t} onDeleteError={() => setDeleteFailed(true)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Fab href="/expenses/add" />

      {sheetOpen && (
        <FilterSheet categories={categories} vendors={vendors} locations={locations}
          filters={filters} onChange={setFilters} onClose={() => setSheetOpen(false)} />
      )}

      {manageOpen && (
        <ManageSheet categories={categories} vendors={vendors} locations={locations}
          onClose={() => setManageOpen(false)} />
      )}
    </div>
  )
}

function ExpenseRowCard({
  row,
  t,
  onDeleteError,
}: {
  row: ExpenseRow
  t: (key: string) => string
  onDeleteError: () => void
}) {
  const router = useRouter()
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const dragState = useRef<{ startX: number; startDragX: number; moved: boolean } | null>(null)

  // Title: the note (details); fall back to the category when there's no note.
  const title = row.details || row.category_name || t('expenses.title')
  // Subtitle: where it was spent — vendor + location.
  const subParts = [row.vendor_name, row.location_name].filter((p): p is string => Boolean(p))

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    dragState.current = { startX: e.clientX, startDragX: dragX, moved: false }
    setDragging(true)
  }
  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const ds = dragState.current
    if (!ds) return
    const delta = e.clientX - ds.startX
    if (Math.abs(delta) > 8) ds.moved = true
    const next = Math.min(0, Math.max(-REVEAL_WIDTH, ds.startDragX + delta))
    setDragX(next)
  }
  function onPointerUp() {
    const ds = dragState.current
    if (!ds) return
    dragState.current = null
    setDragging(false)
    // A tap (no real drag) on a closed row opens the detail sheet.
    if (!ds.moved && ds.startDragX === 0) {
      setDragX(0)
      setDetailOpen(true)
      return
    }
    setDragX((x) => (x < -REVEAL_WIDTH / 2 ? -REVEAL_WIDTH : 0))
  }
  function onPointerCancel() {
    const ds = dragState.current
    if (!ds) return
    dragState.current = null
    setDragging(false)
    setDragX((x) => (x < -REVEAL_WIDTH / 2 ? -REVEAL_WIDTH : 0))
  }

  return (
    <>
      <div className="relative overflow-hidden rounded-[16px]">
        {/* revealed actions, sit behind the row */}
        <div className="absolute inset-y-0 right-0 flex" style={{ width: REVEAL_WIDTH }}>
          <button
            type="button"
            onClick={() => {
              setDragX(0)
              router.push(`/expenses/edit/${row.id}`)
            }}
            className="pressable-opacity flex h-full flex-1 items-center justify-center text-sm font-bold text-white"
            style={{ background: 'var(--pending-text)' }}
          >
            {t('expenses.edit')}
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={() => setConfirmOpen(true)}
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
          onPointerCancel={onPointerCancel}
          className="relative flex touch-pan-y items-center gap-3 rounded-[16px] bg-[var(--surface)] p-3 shadow-[0_3px_10px_oklch(0.5_0.05_45/.05)]"
          style={{ transform: `translateX(${dragX}px)`, transition: dragging ? 'none' : 'transform 160ms ease' }}
        >
          {/* left icon: who paid, or a neutral tag when the payer is unset */}
          {row.paid_by ? (
            <MemberAvatar member={row.paid_by} size={44} />
          ) : (
            <IconTile name="Tag" tint="var(--subtle)" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-[var(--ink)]">{title}</p>
            {subParts.length > 0 && (
              <p className="truncate text-xs text-[var(--muted)]">{subParts.join(' · ')}</p>
            )}
          </div>
          <MoneyText cents={row.amount_cents} className="shrink-0 text-sm font-bold text-[var(--ink-head)]" />
        </div>
      </div>
      {confirmOpen && (
        <ConfirmDialog
          message={t('expenses.confirmDelete')}
          confirmLabel={t('expenses.delete')}
          cancelLabel={t('common.cancel')}
          busy={deleting}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={async () => {
            setDeleting(true)
            const res = await deleteExpenseAction(row.id)
            if (!res.ok) {
              setDeleting(false)
              setConfirmOpen(false)
              onDeleteError()
            }
            // on success the row is removed by revalidatePath; dialog unmounts with it
          }}
        />
      )}
      {detailOpen && <ExpenseDetailSheet row={row} onClose={() => setDetailOpen(false)} />}
    </>
  )
}
