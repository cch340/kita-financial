'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import { useT } from '@/i18n/LocaleProvider'
import { Spinner } from '@/components/ui/Spinner'
import type { CatalogItem } from '@/lib/data/catalog-shared'
import {
  createItemAction, renameItemAction, deleteItemAction, countUsageAction, type CatalogKind,
} from './actions'

export function ManageSection({
  kind, title, items,
}: { kind: CatalogKind; title: string; items: CatalogItem[] }) {
  const t = useT()
  const router = useRouter()
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function add() {
    const name = newName.trim()
    if (!name || adding) return
    setAdding(true); setError(null)
    const res = await createItemAction(kind, name)
    setAdding(false)
    if (!res.ok) { setError(res.error === 'duplicate' ? t('manage.duplicate') : t('error.save_failed')); return }
    setNewName(''); router.refresh()
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{title}</h2>
      <div className="flex flex-col gap-2 rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-3">
        {items.length === 0 && (
          <p className="px-1 py-2 text-sm font-semibold text-[var(--faint)]">{t('manage.empty')}</p>
        )}
        {items.map((item) => (
          <ManageRow key={item.id} kind={kind} item={item} onChanged={() => router.refresh()} />
        ))}
        <div className="flex items-center gap-2 pt-1">
          <input
            value={newName}
            onChange={(e) => { setNewName(e.target.value); setError(null) }}
            onKeyDown={(e) => { if (e.key === 'Enter') add() }}
            placeholder={t('manage.addPlaceholder')}
            className="min-h-[44px] flex-1 rounded-xl border border-[var(--hairline)] bg-[var(--paper)] px-3 text-base text-[var(--ink)] outline-none placeholder:text-[var(--faint)]"
          />
          <button
            type="button" onClick={add} disabled={!newName.trim() || adding} aria-busy={adding}
            className="pressable grid h-11 w-11 place-items-center rounded-xl bg-[var(--primary-btn)] text-white disabled:opacity-40"
          >
            {adding ? <Spinner /> : <Plus size={20} />}
          </button>
        </div>
        {error && <p className="px-1 text-xs font-semibold text-[var(--danger)]">{error}</p>}
      </div>
    </section>
  )
}

function ManageRow({
  kind, item, onChanged,
}: { kind: CatalogKind; item: CatalogItem; onChanged: () => void }) {
  const t = useT()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(item.name)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    const clean = name.trim()
    if (!clean || busy) return
    setBusy(true); setError(null)
    const res = await renameItemAction(kind, item.id, clean)
    setBusy(false)
    if (!res.ok) { setError(res.error === 'duplicate' ? t('manage.duplicate') : t('error.save_failed')); return }
    setEditing(false); onChanged()
  }

  async function remove() {
    if (busy) return
    const count = await countUsageAction(kind, item.id)
    const msg = count > 0 ? t('manage.deleteInUse').replace('{n}', String(count)) : `${t('manage.delete')}?`
    if (!window.confirm(msg)) return
    setBusy(true)
    const res = await deleteItemAction(kind, item.id)
    setBusy(false)
    if (res.ok) onChanged()
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          value={name} autoFocus
          onChange={(e) => { setName(e.target.value); setError(null) }}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
          className="min-h-[44px] flex-1 rounded-xl border border-[var(--primary)] bg-[var(--paper)] px-3 text-base text-[var(--ink)] outline-none"
        />
        <button type="button" onClick={save} disabled={busy} className="pressable grid h-11 w-11 place-items-center rounded-xl bg-[var(--primary-btn)] text-white disabled:opacity-40">
          {busy ? <Spinner /> : <Check size={18} />}
        </button>
        <button type="button" onClick={() => { setEditing(false); setName(item.name) }} className="pressable grid h-11 w-11 place-items-center rounded-xl border border-[var(--hairline)] text-[var(--muted)]">
          <X size={18} />
        </button>
        {error && <span className="text-xs font-semibold text-[var(--danger)]">{error}</span>}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="flex-1 truncate px-1 text-sm font-bold text-[var(--ink)]">{item.name}</span>
      <button type="button" aria-label={t('manage.rename')} onClick={() => setEditing(true)} className="pressable-opacity grid h-11 w-11 place-items-center text-[var(--muted)]">
        <Pencil size={16} />
      </button>
      <button type="button" aria-label={t('manage.delete')} onClick={remove} disabled={busy} className="pressable-opacity grid h-11 w-11 place-items-center text-[var(--danger)] disabled:opacity-40">
        {busy ? <Spinner /> : <Trash2 size={16} />}
      </button>
    </div>
  )
}
