'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/i18n/LocaleProvider'
import { Spinner } from '@/components/ui/Spinner'
import { Fab } from '@/components/ui/Fab'
import { addAssetTransaction } from '@/app/(app)/assets/actions'
import { createAssetCategory } from '@/app/(app)/assets/categories/actions'
import { parseMoneyInput } from '@/lib/money'
import type { AssetCategory, AssetType } from '@/lib/data/assets-shared'

export function AddTxn({
  assetId,
  assetType,
  categories,
  defaultDirection = 'out',
}: {
  assetId: string
  assetType: AssetType
  categories: AssetCategory[]
  defaultDirection?: 'in' | 'out'
}) {
  const t = useT()
  const router = useRouter()
  const todayISO = new Date().toISOString().slice(0, 10)

  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(todayISO)
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [direction, setDirection] = useState<'in' | 'out'>(defaultDirection)
  const [categoryId, setCategoryId] = useState('')
  const [notes, setNotes] = useState('')
  const [addingCat, setAddingCat] = useState(false)
  const [newCat, setNewCat] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(false)

  const cents = parseMoneyInput(amount)
  const canSubmit = cents > 0 && !submitting

  async function handleAddCategory() {
    const name = newCat.trim()
    if (!name) return
    const res = await createAssetCategory({ assetType, name })
    if (res.ok && res.id) {
      setCategoryId(res.id)
      setAddingCat(false)
      setNewCat('')
      router.refresh()
    } else {
      setError(true)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError(false)
    const res = await addAssetTransaction({
      assetId, date, description: description.trim() || null, amountCents: cents,
      direction, categoryId: categoryId || null, notes: notes.trim() || null,
    })
    setSubmitting(false)
    if (!res.ok) { setError(true); return }
    setDate(todayISO); setDescription(''); setAmount(''); setCategoryId(''); setDirection(defaultDirection); setNotes('')
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <Fab onClick={() => setOpen(true)} />
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/30" onClick={() => setOpen(false)}>
          <div
            className="mx-auto max-h-[90dvh] w-full max-w-[430px] overflow-y-auto rounded-t-2xl bg-[var(--paper)] p-5 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-[var(--ink-head)]">{t('asset.addTxn')}</span>
                <button type="button" onClick={() => setOpen(false)} aria-label={t('common.close')}
                  className="pressable-opacity grid h-11 w-11 place-items-center text-xl text-[var(--muted)]">×</button>
              </div>

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

              {error && <p role="alert" className="text-sm font-semibold text-[var(--danger)]">{t('error.save_failed')}</p>}

              <button type="submit" disabled={!canSubmit} aria-busy={submitting}
                className="pressable flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary-btn)] py-3 text-sm font-bold text-white disabled:opacity-40">
                {submitting && <Spinner />}
                {t('asset.form.save')}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
