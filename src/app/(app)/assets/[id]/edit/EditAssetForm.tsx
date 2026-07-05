'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useT } from '@/i18n/LocaleProvider'
import { Spinner } from '@/components/ui/Spinner'
import { parseMoneyInput } from '@/lib/money'
import type { Asset } from '@/lib/data/assets-shared'
import { updateAsset, setAssetStatus } from '@/app/(app)/assets/actions'

function metaString(md: Record<string, unknown>, key: string): string {
  const v = md[key]
  return typeof v === 'string' ? v : ''
}
function metaMoney(md: Record<string, unknown>, key: string): string {
  const v = md[key]
  return typeof v === 'number' ? (v / 100).toFixed(2) : ''
}

export function EditAssetForm({ asset }: { asset: Asset }) {
  const t = useT()
  const router = useRouter()
  const md = asset.metadata ?? {}

  const [name, setName] = useState(asset.name)
  const [address, setAddress] = useState(metaString(md, 'address'))
  const [monthlyCommitment, setMonthlyCommitment] = useState(metaMoney(md, 'monthlyCommitmentCents'))
  const [plate, setPlate] = useState(metaString(md, 'plate'))
  const [installment, setInstallment] = useState(metaMoney(md, 'installmentCents'))
  const [notes, setNotes] = useState(metaString(md, 'notes'))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function buildMetadata(): Record<string, unknown> {
    if (asset.type === 'property') return { ...md, address, monthlyCommitmentCents: parseMoneyInput(monthlyCommitment) }
    if (asset.type === 'vehicle') return { ...md, plate, installmentCents: parseMoneyInput(installment) }
    if (asset.type === 'other') return { ...md, notes }
    return md
  }

  async function save() {
    setBusy(true)
    setError(null)
    const res = await updateAsset({ id: asset.id, name, metadata: buildMetadata() })
    setBusy(false)
    if (!res.ok) { setError(res.error ?? 'save_failed'); return }
    router.push(`/assets/${asset.id}`)
  }

  async function toggleStatus() {
    setBusy(true)
    setError(null)
    const res = await setAssetStatus({ id: asset.id, status: asset.status === 'active' ? 'closed' : 'active' })
    setBusy(false)
    if (!res.ok) { setError('save_failed'); return }
    router.push(`/assets/${asset.id}`)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[var(--paper)]">
      <div className="mx-auto flex min-h-full max-w-[430px] flex-col px-[18px] pb-6 pt-4">
        <div className="flex items-center justify-between py-2">
          <Link href={`/assets/${asset.id}`} aria-label={t('common.back')}
            className="pressable-opacity grid h-11 w-11 place-items-center text-2xl text-[var(--muted)]">‹</Link>
          <h1 className="text-base font-bold text-[var(--ink-head)]">{t('assets.editAsset')}</h1>
          <div className="h-11 w-11" />
        </div>

        <div className="flex flex-1 flex-col gap-3 pt-2">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-[var(--muted)]">{t('assets.name')}</span>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--ink)] outline-none" />
          </label>

          {asset.type === 'property' && (
            <>
              <TextField label={t('assets.field.address')} value={address} onChange={setAddress} />
              <MoneyField label={t('assets.field.monthlyCommitment')} value={monthlyCommitment} onChange={setMonthlyCommitment} />
            </>
          )}
          {asset.type === 'vehicle' && (
            <>
              <TextField label={t('assets.field.plate')} value={plate} onChange={setPlate} />
              <MoneyField label={t('assets.field.installment')} value={installment} onChange={setInstallment} />
            </>
          )}
          {asset.type === 'other' && <TextField label={t('assets.field.notes')} value={notes} onChange={setNotes} />}

          {error && <p role="alert" className="text-sm font-semibold text-[var(--danger)]">{t(`error.${error}`)}</p>}

          <div className="flex-1" />

          <button type="button" onClick={save} disabled={busy || !name.trim()} aria-busy={busy}
            className="pressable flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary-btn)] py-3 text-sm font-bold text-white disabled:opacity-40">
            {busy && <Spinner />}
            {t('asset.form.saveChanges')}
          </button>
          <button type="button" onClick={toggleStatus} disabled={busy}
            className="pressable min-h-[44px] w-full rounded-xl border border-[var(--hairline)] py-3 text-sm font-bold text-[var(--muted)] disabled:opacity-40">
            {asset.status === 'active' ? t('assets.close') : t('assets.reopen')}
          </button>
        </div>
      </div>
    </div>
  )
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-semibold text-[var(--muted)]">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--ink)] outline-none placeholder:text-[var(--faint)]" />
    </label>
  )
}

function MoneyField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-semibold text-[var(--muted)]">{label}</span>
      <div className="flex items-center gap-2 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3">
        <span className="text-sm font-semibold text-[var(--muted)]">RM</span>
        <input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} placeholder="0.00"
          className="flex-1 bg-transparent text-base text-[var(--ink)] outline-none placeholder:text-[var(--faint)]" />
      </div>
    </label>
  )
}
