'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2, Repeat, SlidersHorizontal } from 'lucide-react'
import { useT } from '@/i18n/LocaleProvider'
import { monthShort } from '@/lib/data/summary'
import {
  filterRecords, filteredTotal, totalContributedThisYear,
  type FundRecord, type FundFilters,
} from '@/lib/data/fund-shared'
import type { Member } from '@/lib/data/types'
import { Card, HeroCard } from '@/components/ui/Card'
import { MemberAvatar } from '@/components/ui/MemberAvatar'
import { MoneyText } from '@/components/ui/MoneyText'
import { Fab } from '@/components/ui/Fab'
import type { FundConfig } from '@/lib/data/fund'
import { FundConfigEditor } from './FundConfigEditor'
import { deleteFundRecordAction } from './actions'

const MEMBERS: Member[] = ['CH', 'JC']

export function FundView({
  records, currentYear, locale, config,
}: {
  records: FundRecord[]
  currentYear: number
  locale: 'en' | 'zh'
  config: FundConfig
}) {
  const t = useT()
  const router = useRouter()
  const [editingConfig, setEditingConfig] = useState(false)
  const [busy, setBusy] = useState(false)
  const [filters, setFilters] = useState<FundFilters>({ member: 'all', month: 'all', year: currentYear })

  const years = useMemo(() => {
    const set = new Set<number>(records.map((r) => Number(r.periodISO.slice(0, 4))))
    set.add(currentYear)
    return Array.from(set).sort((a, b) => b - a)
  }, [records, currentYear])

  const shown = useMemo(() => filterRecords(records, filters), [records, filters])
  const shownTotal = useMemo(() => filteredTotal(records, filters), [records, filters])
  const yearTotal = useMemo(() => totalContributedThisYear(records, currentYear), [records, currentYear])

  async function handleDelete(id: string) {
    if (busy || !confirm(t('fund.deleteConfirm'))) return
    setBusy(true)
    await deleteFundRecordAction(id)
    router.refresh()
    setBusy(false)
  }

  return (
    // pb-28 clears the fixed FAB (bottom-[100px], h-14) so the last rows scroll past it.
    <div className="flex flex-col gap-5 pb-28">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-[var(--ink-head)]">{t('fund.title')}</h1>
        <div className="flex items-center gap-1">
          <Link href="/fund/recurring" aria-label={t('fund.manageRecurring')}
            className="pressable-opacity grid h-11 w-11 place-items-center rounded-full text-[var(--muted)]">
            <Repeat size={18} />
          </Link>
          <button type="button" onClick={() => setEditingConfig((v) => !v)} aria-label={t('fund.editConfig')}
            aria-expanded={editingConfig}
            className="pressable-opacity grid h-11 w-11 place-items-center rounded-full text-[var(--muted)]">
            <SlidersHorizontal size={16} />
          </button>
        </div>
      </header>

      {editingConfig && <FundConfigEditor config={config} onClose={() => setEditingConfig(false)} />}

      <HeroCard>
        <span className="text-sm font-bold opacity-90">{t('fund.thisYearTotal')}</span>
        <div className="mt-1"><MoneyText cents={yearTotal} className="text-[32px] font-extrabold" /></div>
        <p className="mt-2 flex items-center gap-1 text-sm font-semibold opacity-80">
          {t('fund.filteredTotal')} · <MoneyText cents={shownTotal} />
        </p>
      </HeroCard>

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

      <Card className="overflow-hidden p-0">
        {shown.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[var(--faint)]">{t('fund.noRecords')}</p>
        ) : shown.map((r, i) => (
          <div key={r.id}
            className={`flex items-center justify-between gap-3 px-4 py-3 ${i < shown.length - 1 ? 'border-b border-[var(--hairline)]' : ''}`}>
            <div className="flex min-w-0 items-center gap-3">
              <MemberAvatar member={r.memberCode} size={32} />
              <div className="min-w-0">
                <p className="text-sm font-bold text-[var(--ink-head)]">
                  {monthShort(Number(r.periodISO.slice(5, 7)), locale)} {r.periodISO.slice(0, 4)}
                </p>
                {r.notes && <p className="truncate text-xs text-[var(--muted)]">{r.notes}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <MoneyText cents={r.amountCents} className="text-sm font-bold" />
              <Link href={`/fund/record/edit/${r.id}`} aria-label={t('fund.editRecord')}
                className="pressable-opacity grid h-9 w-9 place-items-center rounded-full text-[var(--muted)]"><Pencil size={15} /></Link>
              <button type="button" onClick={() => handleDelete(r.id)} aria-label={t('fund.delete')}
                className="pressable-opacity grid h-9 w-9 place-items-center rounded-full text-[var(--danger)]"><Trash2 size={15} /></button>
            </div>
          </div>
        ))}
      </Card>

      <Fab href="/fund/record/add" label={t('fund.addRecord')} />
    </div>
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
