'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useT } from '@/i18n/LocaleProvider'
import { Spinner } from '@/components/ui/Spinner'
import { parseMoneyInput } from '@/lib/money'
import type { AssetTxn, AssetType } from '@/lib/data/assets-shared'
import { updateAssetTransaction, deleteAssetTransaction } from '@/app/(app)/assets/actions'

export function EditTxnForm({
  assetId,
  txn,
  assetType,
}: {
  assetId: string
  txn: AssetTxn
  assetType: AssetType
}) {
  const t = useT()
  const router = useRouter()

  const [date, setDate] = useState(txn.date)
  const [description, setDescription] = useState(txn.description ?? '')
  const [amount, setAmount] = useState((txn.amountCents / 100).toFixed(2))
  const [direction, setDirection] = useState<'in' | 'out'>(txn.direction)
  const [txnType, setTxnType] = useState(txn.txnType ?? '')
  const [settled, setSettled] = useState(txn.settled)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cents = parseMoneyInput(amount)
  const canSave = cents > 0 && !busy

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!canSave) return
    setBusy(true)
    setError(null)
    const res = await updateAssetTransaction({
      id: txn.id, assetId, date, description: description.trim() || null, amountCents: cents,
      direction, txnType: txnType.trim() || null, settled, seq: txn.seq, notes: txn.notes,
    })
    setBusy(false)
    if (!res.ok) { setError(res.error ?? 'save_failed'); return }
    router.push(`/assets/${assetId}`)
  }

  async function remove() {
    setBusy(true)
    setError(null)
    const res = await deleteAssetTransaction({ id: txn.id, assetId })
    setBusy(false)
    if (!res.ok) { setError('delete_failed'); return }
    router.push(`/assets/${assetId}`)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[var(--paper)]">
      <div className="mx-auto flex min-h-full max-w-[430px] flex-col px-[18px] pb-6 pt-4">
        <div className="flex items-center justify-between py-2">
          <Link
            href={`/assets/${assetId}`}
            aria-label={t('common.back')}
            className="pressable-opacity grid h-11 w-11 place-items-center text-2xl text-[var(--muted)]"
          >
            ‹
          </Link>
          <h1 className="text-base font-bold text-[var(--ink-head)]">{t('asset.editTxn')}</h1>
          <div className="h-11 w-11" />
        </div>

        <form onSubmit={save} className="flex flex-1 flex-col gap-3 pt-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-[var(--muted)]">{t('asset.form.date')}</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--ink)] outline-none"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-[var(--muted)]">{t('asset.form.description')}</span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--ink)] outline-none placeholder:text-[var(--faint)]"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-[var(--muted)]">{t('asset.form.amount')}</span>
            <div className="flex items-center gap-2 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3">
              <span className="text-sm font-semibold text-[var(--muted)]">RM</span>
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="flex-1 bg-transparent text-base text-[var(--ink)] outline-none placeholder:text-[var(--faint)]"
              />
            </div>
          </label>

          <div className="flex gap-2">
            {(['in', 'out'] as const).map((d) => {
              const selected = direction === d
              const color = d === 'in' ? 'var(--positive-text)' : 'var(--primary)'
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDirection(d)}
                  className="pressable min-h-[44px] flex-1 rounded-xl border py-2.5 text-sm font-semibold"
                  style={{
                    borderColor: selected ? color : 'var(--hairline)',
                    background: selected ? color : 'var(--surface)',
                    color: selected ? 'white' : 'var(--ink)',
                  }}
                >
                  {t(d === 'in' ? 'asset.in' : 'asset.out')}
                </button>
              )
            })}
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-[var(--muted)]">{t('asset.form.txnType')}</span>
            <input
              value={txnType}
              onChange={(e) => setTxnType(e.target.value)}
              className="w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--ink)] outline-none placeholder:text-[var(--faint)]"
            />
          </label>

          <button
            type="button"
            onClick={() => setSettled((s) => !s)}
            className="pressable flex min-h-[44px] items-center justify-between rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-sm font-semibold text-[var(--ink)]"
          >
            <span>{assetType === 'property' ? t('asset.transferred') : t('status.paid')}</span>
            <span
              className="relative inline-block h-7 w-12 rounded-full transition-colors"
              style={{ background: settled ? 'var(--positive-text)' : 'var(--hairline)' }}
            >
              <span
                className="absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform"
                style={{ transform: settled ? 'translateX(22px)' : 'translateX(4px)' }}
              />
            </span>
          </button>

          {error && <p role="alert" className="text-sm font-semibold text-[var(--danger)]">{t(`error.${error}`)}</p>}

          <div className="flex-1" />

          <button
            type="submit"
            disabled={!canSave}
            aria-busy={busy}
            className="pressable flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary-btn)] py-3 text-sm font-bold text-white disabled:opacity-40"
          >
            {busy && <Spinner />}
            {t('asset.form.saveChanges')}
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="pressable min-h-[44px] w-full rounded-xl border border-[var(--hairline)] py-3 text-sm font-bold text-[var(--danger)] disabled:opacity-40"
          >
            {t('asset.deleteTxn')}
          </button>
        </form>
      </div>
    </div>
  )
}
