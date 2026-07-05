'use client'
import { useMemo, useState } from 'react'
import { ChevronDown, Plus, Check } from 'lucide-react'
import { useT } from '@/i18n/LocaleProvider'
import { Spinner } from '@/components/ui/Spinner'
import { normalizeName, findCaseInsensitiveDuplicate, type CatalogItem } from '@/lib/data/catalog-shared'

type Props = {
  label: string
  placeholder: string
  items: CatalogItem[]
  valueId: string | null
  onChange: (id: string | null) => void
  onCreate: (name: string) => Promise<{ ok: true; id: string } | { ok: false; error: string }>
}

export function Combobox({ label, placeholder, items, valueId, onChange, onCreate }: Props) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [localItems, setLocalItems] = useState<CatalogItem[]>(items)

  const selected = localItems.find((i) => i.id === valueId) ?? null
  const clean = normalizeName(query)
  const filtered = useMemo(() => {
    const q = clean.toLowerCase()
    return q ? localItems.filter((i) => i.name.toLowerCase().includes(q)) : localItems
  }, [localItems, clean])
  const exactExists = clean !== '' && findCaseInsensitiveDuplicate(clean, localItems) !== null
  const canCreate = clean !== '' && !exactExists

  async function create() {
    if (!canCreate || creating) return
    setCreating(true)
    const res = await onCreate(clean)
    setCreating(false)
    if (res.ok) {
      const item = { id: res.id, name: clean, sort_order: localItems.length }
      setLocalItems((prev) => [...prev, item])
      onChange(res.id)
      setQuery(''); setOpen(false)
    }
    // duplicate race: item already exists — leave panel open, user can pick it
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-[var(--muted)]">{label}</span>
      <button
        type="button" onClick={() => setOpen((v) => !v)}
        className="flex min-h-[44px] items-center justify-between gap-2 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-left"
      >
        <span className={selected ? 'text-base text-[var(--ink)]' : 'text-base text-[var(--faint)]'}>
          {selected ? selected.name : placeholder}
        </span>
        <ChevronDown size={18} className="shrink-0 text-[var(--muted)]" />
      </button>

      {open && (
        <div className="mt-1 flex flex-col gap-1 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-2 shadow-[0_6px_20px_oklch(0.5_0.05_45/.12)]">
          <input
            value={query} autoFocus
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && canCreate) create() }}
            placeholder={t('combobox.search')}
            className="min-h-[40px] rounded-lg border border-[var(--hairline)] bg-[var(--paper)] px-3 text-base text-[var(--ink)] outline-none placeholder:text-[var(--faint)]"
          />
          <div className="flex max-h-48 flex-col overflow-y-auto">
            {selected && (
              <button type="button" onClick={() => { onChange(null); setOpen(false) }}
                className="pressable-opacity flex min-h-[40px] items-center px-3 text-sm font-semibold text-[var(--muted)]">
                {t('combobox.none')}
              </button>
            )}
            {filtered.map((i) => (
              <button key={i.id} type="button" onClick={() => { onChange(i.id); setQuery(''); setOpen(false) }}
                className="pressable-opacity flex min-h-[40px] items-center justify-between gap-2 px-3 text-sm font-semibold text-[var(--ink)]">
                <span className="truncate">{i.name}</span>
                {i.id === valueId && <Check size={16} className="text-[var(--primary)]" />}
              </button>
            ))}
            {canCreate && (
              <button type="button" onClick={create} disabled={creating}
                className="pressable-opacity flex min-h-[40px] items-center gap-2 px-3 text-sm font-bold text-[var(--primary)] disabled:opacity-50">
                {creating ? <Spinner /> : <Plus size={16} />}
                {t('combobox.create').replace('{name}', clean)}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
