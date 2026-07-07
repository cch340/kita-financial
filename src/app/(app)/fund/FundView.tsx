'use client'
import { useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { SlidersHorizontal } from 'lucide-react'
import { useT } from '@/i18n/LocaleProvider'
import { monthShort } from '@/lib/data/summary'
import {
  filterRecords, filteredTotal, totalContributedThisYear,
  type FundRecord, type FundFilters,
} from '@/lib/data/fund-shared'
import type { Member } from '@/lib/data/types'
import { HeroCard } from '@/components/ui/Card'
import { MemberAvatar } from '@/components/ui/MemberAvatar'
import { MoneyText } from '@/components/ui/MoneyText'
import { Fab } from '@/components/ui/Fab'
import { Spinner } from '@/components/ui/Spinner'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { deleteFundRecordAction } from './actions'
import { FundDetailSheet } from './FundDetailSheet'

const MEMBERS: Member[] = ['CH', 'JC']
const REVEAL_WIDTH = 152 // px — two 76px action buttons behind each row

export function FundView({
  records, currentYear, locale,
}: {
  records: FundRecord[]
  currentYear: number
  locale: 'en' | 'zh'
}) {
  const t = useT()
  const [deleteFailed, setDeleteFailed] = useState(false)
  const [filters, setFilters] = useState<FundFilters>({ member: 'all', month: 'all', year: currentYear })

  const years = useMemo(() => {
    const set = new Set<number>(records.map((r) => Number(r.periodISO.slice(0, 4))))
    set.add(currentYear)
    return Array.from(set).sort((a, b) => b - a)
  }, [records, currentYear])

  const shown = useMemo(() => filterRecords(records, filters), [records, filters])
  const shownTotal = useMemo(() => filteredTotal(records, filters), [records, filters])
  const yearTotal = useMemo(() => totalContributedThisYear(records, currentYear), [records, currentYear])

  return (
    // pb-28 clears the fixed FAB (bottom-[100px], h-14) so the last rows scroll past it.
    <div className="flex flex-col gap-5 pb-28">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-[var(--ink-head)]">{t('fund.title')}</h1>
        <Link href="/fund/recurring" aria-label={t('fund.manageRecurring')}
          className="pressable-opacity grid h-11 w-11 place-items-center rounded-full text-[var(--muted)]">
          <SlidersHorizontal size={18} />
        </Link>
      </header>

      <HeroCard>
        <span className="text-sm font-bold opacity-90">{t('fund.thisYearTotal')}</span>
        <div className="mt-1"><MoneyText cents={yearTotal} className="text-[32px] font-extrabold" /></div>
        <p className="mt-2 flex items-center gap-1 text-sm font-semibold opacity-80">
          {t('fund.filteredTotal')} · <MoneyText cents={shownTotal} />
        </p>
      </HeroCard>

      {deleteFailed && (
        <p role="alert" className="rounded-xl bg-[var(--pending-bg)] px-4 py-2 text-sm font-semibold text-[var(--danger)]">
          {t('error.delete_failed')}
        </p>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <FilterSelect label={t('fund.paidBy')} value={String(filters.member)}
          onChange={(v) => setFilters((f) => ({ ...f, member: v === 'all' ? 'all' : (v as Member) }))}
          options={[{ v: 'all', label: t('fund.allPersons') }, ...MEMBERS.map((m) => ({ v: m, label: m }))]} />
        <FilterSelect label={t('fund.month')} value={String(filters.month)}
          onChange={(v) => setFilters((f) => ({ ...f, month: v === 'all' ? 'all' : Number(v) }))}
          options={[{ v: 'all', label: t('fund.allMonths') },
            ...Array.from({ length: 12 }, (_, i) => ({ v: String(i + 1), label: monthShort(i + 1, locale) }))]} />
        <FilterSelect label={t('fund.year')} value={String(filters.year)}
          onChange={(v) => setFilters((f) => ({ ...f, year: Number(v) }))}
          options={years.map((y) => ({ v: String(y), label: String(y) }))} />
      </div>

      {/* records list — swipe a row left to reveal edit/delete (mirrors the expenses list) */}
      {shown.length === 0 ? (
        <p className="py-10 text-center text-sm font-semibold text-[var(--faint)]">{t('fund.noRecords')}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {shown.map((r) => (
            <FundRecordCard key={r.id} row={r} locale={locale} t={t} onDeleteError={() => setDeleteFailed(true)} />
          ))}
        </div>
      )}

      <Fab href="/fund/record/add" />
    </div>
  )
}

function FundRecordCard({
  row, locale, t, onDeleteError,
}: {
  row: FundRecord
  locale: 'en' | 'zh'
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

  const monthLabel = `${monthShort(Number(row.periodISO.slice(5, 7)), locale)} ${row.periodISO.slice(0, 4)}`

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
    setDragX(Math.min(0, Math.max(-REVEAL_WIDTH, ds.startDragX + delta)))
  }
  function onPointerUp() {
    const ds = dragState.current
    if (!ds) return
    dragState.current = null
    setDragging(false)
    if (!ds.moved && ds.startDragX === 0) {
      setDragX(0)
      setDetailOpen(true)
      return
    }
    setDragX((x) => (x < -REVEAL_WIDTH / 2 ? -REVEAL_WIDTH : 0))
  }

  return (
    <>
      <div className="relative overflow-hidden rounded-[16px]">
        {/* revealed actions, sit behind the row */}
        <div className="absolute inset-y-0 right-0 flex" style={{ width: REVEAL_WIDTH }}>
          <button type="button"
            onClick={() => { setDragX(0); router.push(`/fund/record/edit/${row.id}`) }}
            className="pressable-opacity flex h-full flex-1 items-center justify-center text-sm font-bold text-white"
            style={{ background: 'var(--pending-text)' }}>
            {t('fund.edit')}
          </button>
          <button type="button" disabled={deleting}
            onClick={() => setConfirmOpen(true)}
            className="pressable-opacity flex h-full flex-1 items-center justify-center text-sm font-bold text-white"
            style={{ background: 'var(--danger)' }}>
            {deleting ? <Spinner /> : t('fund.delete')}
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
          <MemberAvatar member={row.memberCode} size={44} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-[var(--ink)]">{monthLabel}</p>
            {row.notes && <p className="truncate text-xs text-[var(--muted)]">{row.notes}</p>}
          </div>
          <MoneyText cents={row.amountCents} className="shrink-0 text-sm font-bold text-[var(--ink-head)]" />
        </div>
      </div>
      {confirmOpen && (
        <ConfirmDialog
          message={t('fund.confirmDelete')}
          confirmLabel={t('fund.delete')}
          cancelLabel={t('common.cancel')}
          busy={deleting}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={async () => {
            setDeleting(true)
            const res = await deleteFundRecordAction(row.id)
            if (!res.ok) {
              setDeleting(false)
              setConfirmOpen(false)
              onDeleteError()
            }
          }}
        />
      )}
      {detailOpen && <FundDetailSheet row={row} locale={locale} onClose={() => setDetailOpen(false)} />}
    </>
  )
}

function FilterSelect({
  label, value, onChange, options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { v: string; label: string }[]
}) {
  return (
    <label className="flex items-center gap-1 rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--ink)]">
      <span className="text-[var(--muted)]">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="bg-transparent font-bold text-[var(--ink)] outline-none">
        {options.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
      </select>
    </label>
  )
}
