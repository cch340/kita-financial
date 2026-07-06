'use client'
import { useT } from '@/i18n/LocaleProvider'
import type { CatalogItem } from '@/lib/data/catalog-shared'

export type FilterValue = string | 'other' | null
export type Filters = { categoryId: FilterValue; vendorId: FilterValue; locationId: FilterValue }

function Group({
  title, items, value, onPick,
}: { title: string; items: CatalogItem[]; value: FilterValue; onPick: (v: FilterValue) => void }) {
  const t = useT()
  const chip = (active: boolean) => ({
    borderColor: active ? 'var(--primary)' : 'var(--hairline)',
    background: active ? 'var(--primary)' : 'var(--surface)',
    color: active ? 'white' : 'var(--ink)',
  })
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{title}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((i) => {
          const active = value === i.id
          return (
            <button key={i.id} type="button" onClick={() => onPick(active ? null : i.id)}
              className="pressable flex min-h-[40px] items-center rounded-full border px-3 py-2 text-sm font-semibold whitespace-nowrap"
              style={chip(active)}>{i.name}</button>
          )
        })}
        <button type="button" onClick={() => onPick(value === 'other' ? null : 'other')}
          className="pressable flex min-h-[40px] items-center rounded-full border px-3 py-2 text-sm font-semibold whitespace-nowrap"
          style={chip(value === 'other')}>{t('filter.other')}</button>
      </div>
    </div>
  )
}

export function FilterSheet({
  categories, vendors, locations, filters, onChange, onClose,
}: {
  categories: CatalogItem[]; vendors: CatalogItem[]; locations: CatalogItem[]
  filters: Filters; onChange: (f: Filters) => void; onClose: () => void
}) {
  const t = useT()
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/30" onClick={onClose}>
      <div className="mx-auto w-full max-w-[430px] rounded-t-2xl bg-[var(--paper)] p-5 pb-8"
        onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-[var(--ink-head)]">{t('filter.title')}</h2>
          <button type="button" onClick={() => onChange({ categoryId: null, vendorId: null, locationId: null })}
            className="pressable-opacity text-sm font-bold text-[var(--primary)]">{t('filter.clear')}</button>
        </div>
        <div className="flex max-h-[60vh] flex-col gap-5 overflow-y-auto">
          <Group title={t('expenses.category')} items={categories} value={filters.categoryId}
            onPick={(v) => onChange({ ...filters, categoryId: v })} />
          <Group title={t('add.vendor')} items={vendors} value={filters.vendorId}
            onPick={(v) => onChange({ ...filters, vendorId: v })} />
          <Group title={t('add.location')} items={locations} value={filters.locationId}
            onPick={(v) => onChange({ ...filters, locationId: v })} />
        </div>
        <button type="button" onClick={onClose}
          className="pressable mt-5 w-full rounded-xl bg-[var(--primary-btn)] py-3.5 font-bold text-white">
          {t('filter.apply')}
        </button>
      </div>
    </div>
  )
}
