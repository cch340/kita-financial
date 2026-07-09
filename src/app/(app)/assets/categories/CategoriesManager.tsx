'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronUp, ChevronDown, Trash2, Plus } from 'lucide-react'
import { useT } from '@/i18n/LocaleProvider'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { moveItem } from '@/lib/data/commitments-shared'
import type { AssetCategory, AssetType } from '@/lib/data/assets-shared'
import { createAssetCategory, updateAssetCategory, deleteAssetCategory, reorderAssetCategories } from './actions'

const ASSET_TYPES: AssetType[] = ['property', 'vehicle', 'investment', 'other']

export function CategoriesManager({ categories }: { categories: AssetCategory[] }) {
  const t = useT()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<AssetCategory | null>(null)

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true); setError(null)
    const res = await fn()
    setBusy(false)
    if (!res.ok) { setError(res.error ?? 'save_failed'); return }
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-5 pb-10">
      <header className="flex items-center gap-3">
        <Link href="/assets" aria-label={t('common.back')}
          className="pressable-opacity grid h-11 w-11 shrink-0 place-items-center text-2xl text-[var(--muted)]">‹</Link>
        <h1 className="flex-1 truncate text-xl font-extrabold text-[var(--ink-head)]">{t('assets.categories.title')}</h1>
      </header>

      {error && (
        <p role="alert" className="rounded-xl bg-[var(--pending-bg)] px-4 py-2 text-sm font-semibold text-[var(--danger)]">
          {t(`error.${error}`)}
        </p>
      )}

      <CategoryAdder disabled={busy} onAdd={(assetType, name) => run(() => createAssetCategory({ assetType, name }))} />

      {ASSET_TYPES.map((type) => {
        const rows = categories.filter((c) => c.assetType === type)
        if (rows.length === 0) return null
        return (
          <section key={type} className="flex flex-col gap-2">
            <span className="px-1 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
              {t(`assets.type.${type}`)}
            </span>
            {rows.map((c, i) => (
              <CategoryEditor
                key={c.id}
                row={c}
                disabled={busy}
                canUp={i > 0}
                canDown={i < rows.length - 1}
                onSave={(name, assetType) => run(() => updateAssetCategory({ id: c.id, name, assetType }))}
                onDelete={() => setPendingDelete(c)}
                onMove={(delta) => run(() => reorderAssetCategories({ assetType: type, orderedIds: moveItem(rows, i, delta).map((x) => x.id) }))}
              />
            ))}
          </section>
        )
      })}

      {busy && <div className="flex justify-center py-2"><Spinner /></div>}

      {pendingDelete && (
        <ConfirmDialog
          message={t('assets.categories.confirmDelete')}
          confirmLabel={t('assets.delete')}
          cancelLabel={t('common.cancel')}
          busy={busy}
          onCancel={() => setPendingDelete(null)}
          onConfirm={async () => {
            const id = pendingDelete.id
            setPendingDelete(null)
            await run(() => deleteAssetCategory({ id }))
          }}
        />
      )}
    </div>
  )
}

function MoveButtons({ canUp, canDown, disabled, onMove }: {
  canUp: boolean; canDown: boolean; disabled: boolean; onMove: (delta: -1 | 1) => void
}) {
  return (
    <div className="flex shrink-0 flex-col">
      <button type="button" disabled={disabled || !canUp} onClick={() => onMove(-1)} aria-label="up"
        className="pressable-opacity grid h-6 w-8 place-items-center text-[var(--muted)] disabled:opacity-30">
        <ChevronUp size={16} />
      </button>
      <button type="button" disabled={disabled || !canDown} onClick={() => onMove(1)} aria-label="down"
        className="pressable-opacity grid h-6 w-8 place-items-center text-[var(--muted)] disabled:opacity-30">
        <ChevronDown size={16} />
      </button>
    </div>
  )
}

function TypeSelect({ value, onChange, disabled }: { value: AssetType; onChange: (t: AssetType) => void; disabled?: boolean }) {
  const t = useT()
  return (
    <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as AssetType)}
      className="shrink-0 rounded-lg border border-[var(--hairline)] bg-[var(--surface)] px-2 py-2 text-sm text-[var(--ink)] outline-none">
      {ASSET_TYPES.map((tp) => <option key={tp} value={tp}>{t(`assets.type.${tp}`)}</option>)}
    </select>
  )
}

function CategoryEditor({ row, disabled, canUp, canDown, onSave, onDelete, onMove }: {
  row: AssetCategory; disabled: boolean; canUp: boolean; canDown: boolean
  onSave: (name: string, assetType: AssetType) => void; onDelete: () => void; onMove: (delta: -1 | 1) => void
}) {
  const t = useT()
  const [name, setName] = useState(row.name)
  const [assetType, setAssetType] = useState<AssetType>(row.assetType)
  return (
    <Card className="flex items-start gap-2">
      <MoveButtons canUp={canUp} canDown={canDown} disabled={disabled} onMove={onMove} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('assets.categories.name')}
          className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--ink)] outline-none placeholder:text-[var(--faint)]" />
        <div className="flex items-center gap-2">
          <TypeSelect value={assetType} onChange={setAssetType} disabled={disabled} />
          <button type="button" disabled={disabled || !name.trim()} onClick={() => onSave(name, assetType)}
            className="pressable min-h-[40px] flex-1 rounded-lg bg-[var(--primary-btn)] px-3 text-sm font-bold text-white disabled:opacity-40">
            {t('personal.save')}
          </button>
          <button type="button" disabled={disabled} onClick={onDelete} aria-label={t('personal.delete')}
            className="pressable grid min-h-[40px] w-10 shrink-0 place-items-center rounded-lg border border-[var(--hairline)] text-[var(--danger)] disabled:opacity-40">
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </Card>
  )
}

function CategoryAdder({ disabled, onAdd }: { disabled: boolean; onAdd: (assetType: AssetType, name: string) => void }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [assetType, setAssetType] = useState<AssetType>('property')
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="pressable flex min-h-[44px] w-full items-center justify-center gap-1 rounded-xl border border-dashed border-[var(--primary)] py-3 text-sm font-bold text-[var(--primary)]">
        <Plus size={16} /> {t('assets.categories.add')}
      </button>
    )
  }
  return (
    <Card className="flex flex-col gap-2">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('assets.categories.name')}
        className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--faint)]" />
      <div className="flex items-center gap-2">
        <TypeSelect value={assetType} onChange={setAssetType} disabled={disabled} />
        <button type="button" disabled={disabled || !name.trim()}
          onClick={() => { onAdd(assetType, name.trim()); setOpen(false); setName(''); setAssetType('property') }}
          className="pressable min-h-[40px] flex-1 rounded-lg bg-[var(--primary-btn)] text-sm font-bold text-white disabled:opacity-40">
          {t('assets.categories.addConfirm')}
        </button>
        <button type="button" onClick={() => setOpen(false)} aria-label={t('common.close')}
          className="pressable-opacity grid h-10 w-10 place-items-center text-xl text-[var(--muted)]">×</button>
      </div>
    </Card>
  )
}
