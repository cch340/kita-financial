'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useT } from '@/i18n/LocaleProvider'
import { Spinner } from '@/components/ui/Spinner'
import { ConfirmButton } from '@/components/ui/ConfirmButton'
import { parseMoneyInput } from '@/lib/money'
import type { AssetTxn, AssetType, AssetCategory } from '@/lib/data/assets-shared'
import { updateAssetTransaction, deleteAssetTransaction } from '@/app/(app)/assets/actions'
import { createAssetCategory } from '@/app/(app)/assets/categories/actions'

export function EditTxnForm({
  assetId,
  txn,
  assetType,
  categories,
}: {
  assetId: string
  txn: AssetTxn
  assetType: AssetType
  categories: AssetCategory[]
}) {
  const t = useT()
  const router = useRouter()

  const [date, setDate] = useState(txn.date)
  const [description, setDescription] = useState(txn.description ?? '')
  const [amount, setAmount] = useState((txn.amountCents / 100).toFixed(2))
  const [direction, setDirection] = useState<'in' | 'out'>(txn.direction)
  const [categoryId, setCategoryId] = useState(txn.categoryId ?? '')
  const [notes, setNotes] = useState(txn.notes ?? '')
  const [addingCat, setAddingCat] = useState(false)
  const [newCat, setNewCat] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cents = parseMoneyInput(amount)
  const canSave = cents > 0 && !busy

  async function handleAddCategory() {
    const name = newCat.trim()
    if (!name) return
    const res = await createAssetCategory({ assetType, name })
    if (res.ok && res.id) {
      setCategoryId(res.id); setAddingCat(false); setNewCat(''); router.refresh()
    } else {
      setError(res.error === 'duplicate' ? 'duplicate' : 'save_failed')
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!canSave) return
    setBusy(true); setError(null)
    const res = await updateAssetTransaction({
      id: txn.id, assetId, date, description: description.trim() || null, amountCents: cents,
      direction, categoryId: categoryId || null, notes: notes.trim() || null,
    })
    setBusy(false)
    if (!res.ok) { setError(res.error ?? 'save_failed'); return }
    router.push(`/assets/${assetId}`)
  }

  async function remove() {
    setBusy(true); setError(null)
    const res = await deleteAssetTransaction({ id: txn.id, assetId })
    setBusy(false)
    if (!res.ok) { setError('delete_failed'); return }
    router.push(`/assets/${assetId}`)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[var(--paper)]">
      <div className="mx-auto flex min-h-full max-w-[430px] flex-col px-[18px] pb-6 pt-4">
        <div className="flex items-center justify-between py-2">
          <Link href={`/assets/${assetId}`} aria-label={t('common.back')}
            className="pressable-opacity grid h-11 w-11 place-items-center text-2xl text-[var(--muted)]">‹</Link>
          <h1 className="text-base font-bold text-[var(--ink-head)]">{t('asset.editTxn')}</h1>
          <div className="h-11 w-11" />
        </div>

        <form onSubmit={save} className="flex flex-1 flex-col gap-3 pt-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-[var(--muted)]">{t('asset.form.date')}</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--ink)] outline-none" />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-[var(--muted)]">{t('asset.form.description')}</span>
            <input value={description} onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--ink)] outline-none placeholder:text-[var(--faint)]" />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-[var(--muted)]">{t('asset.form.amount')}</span>
            <div className="flex items-center gap-2 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3">
              <span className="text-sm font-semibold text-[var(--muted)]">RM</span>
              <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
                className="flex-1 bg-transparent text-base text-[var(--ink)] outline-none placeholder:text-[var(--faint)]" />
            </div>
          </label>

          <div className="flex gap-2">
            {(['in', 'out'] as const).map((d) => {
              const selected = direction === d
              const color = d === 'in' ? 'var(--positive-text)' : 'var(--primary)'
              return (
                <button key={d} type="button" onClick={() => setDirection(d)}
                  className="pressable min-h-[44px] flex-1 rounded-xl border py-2.5 text-sm font-semibold"
                  style={{ borderColor: selected ? color : 'var(--hairline)', background: selected ? color : 'var(--surface)', color: selected ? 'white' : 'var(--ink)' }}>
                  {t(d === 'in' ? 'asset.in' : 'asset.out')}
                </button>
              )
            })}
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-[var(--muted)]">{t('asset.form.category')}</span>
            {!addingCat ? (
              <div className="flex gap-2">
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
                  className="flex-1 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--ink)] outline-none">
                  <option value="">{t('asset.category.other')}</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button type="button" onClick={() => setAddingCat(true)} aria-label={t('asset.category.new')}
                  className="pressable grid min-h-[44px] w-12 shrink-0 place-items-center rounded-xl border border-[var(--hairline)] text-xl text-[var(--primary)]">＋</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder={t('asset.category.new')} autoFocus
                  className="flex-1 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--ink)] outline-none placeholder:text-[var(--faint)]" />
                <button type="button" disabled={!newCat.trim()} onClick={handleAddCategory}
                  className="pressable min-h-[44px] shrink-0 rounded-xl bg-[var(--primary-btn)] px-3 text-sm font-bold text-white disabled:opacity-40">
                  {t('assets.categories.addConfirm')}
                </button>
                <button type="button" onClick={() => { setAddingCat(false); setNewCat('') }} aria-label={t('common.close')}
                  className="pressable-opacity grid h-11 w-8 shrink-0 place-items-center text-xl text-[var(--muted)]">×</button>
              </div>
            )}
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-[var(--muted)]">{t('asset.form.note')}</span>
            <input value={notes} onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--ink)] outline-none placeholder:text-[var(--faint)]" />
          </label>

          {error && <p role="alert" className="text-sm font-semibold text-[var(--danger)]">{t(`error.${error}`)}</p>}

          <div className="flex-1" />

          <button type="submit" disabled={!canSave} aria-busy={busy}
            className="pressable flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary-btn)] py-3 text-sm font-bold text-white disabled:opacity-40">
            {busy && <Spinner />}
            {t('asset.form.saveChanges')}
          </button>
          <ConfirmButton onConfirm={remove} label={t('asset.deleteTxn')} confirmLabel={t('common.sure')} disabled={busy}
            className="pressable min-h-[44px] w-full rounded-xl border border-[var(--hairline)] py-3 text-sm font-bold text-[var(--danger)] disabled:opacity-40" />
        </form>
      </div>
    </div>
  )
}
