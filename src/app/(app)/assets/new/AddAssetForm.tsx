'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useT } from '@/i18n/LocaleProvider'
import { Spinner } from '@/components/ui/Spinner'
import { MemberAvatar } from '@/components/ui/MemberAvatar'
import type { AssetType } from '@/lib/data/assets-shared'
import { parseMoneyInput } from '@/lib/money'
import { createAsset } from './actions'

const TYPES: AssetType[] = ['property', 'vehicle', 'investment', 'other']
const MEMBERS = ['CH', 'JC'] as const

export function AddAssetForm() {
  const t = useT()
  const router = useRouter()

  const [type, setType] = useState<AssetType | null>(null)
  const [name, setName] = useState('')

  // property
  const [startingBalance, setStartingBalance] = useState('')
  const [monthlyCommitment, setMonthlyCommitment] = useState('')
  const [address, setAddress] = useState('')
  // vehicle
  const [loanAmount, setLoanAmount] = useState('')
  const [installment, setInstallment] = useState('')
  const [plate, setPlate] = useState('')
  // investment
  const [yearlyPremium, setYearlyPremium] = useState('')
  const [years, setYears] = useState('')
  const [holder, setHolder] = useState<'CH' | 'JC' | null>(null)
  // other
  const [notes, setNotes] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = Boolean(type) && name.trim().length > 0 && !submitting

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!type || !name.trim()) return
    setSubmitting(true)
    setError(null)

    let input: Parameters<typeof createAsset>[0]
    if (type === 'property') {
      input = {
        type,
        name: name.trim(),
        ownerMemberCode: null,
        openingBalanceCents: parseMoneyInput(startingBalance),
        metadata: { monthlyCommitmentCents: parseMoneyInput(monthlyCommitment), address },
      }
    } else if (type === 'vehicle') {
      input = {
        type,
        name: name.trim(),
        ownerMemberCode: null,
        openingBalanceCents: parseMoneyInput(loanAmount),
        metadata: { installmentCents: parseMoneyInput(installment), plate },
      }
    } else if (type === 'investment') {
      input = {
        type,
        name: name.trim(),
        ownerMemberCode: holder,
        openingBalanceCents: null,
        metadata: { yearlyPremiumCents: parseMoneyInput(yearlyPremium), years: Number(years) || 0, holder },
      }
    } else {
      input = {
        type,
        name: name.trim(),
        ownerMemberCode: null,
        openingBalanceCents: parseMoneyInput(startingBalance),
        metadata: { notes },
      }
    }

    const res = await createAsset(input)
    if (res.ok && res.id) {
      router.push(`/assets/${res.id}`)
    } else {
      setError('save_failed')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[var(--paper)]">
      <div className="mx-auto flex min-h-full max-w-[430px] flex-col px-[18px] pb-6 pt-4">
        {/* header */}
        <div className="flex items-center justify-between py-2">
          <Link
            href="/assets"
            aria-label={t('common.close')}
            className="pressable-opacity grid h-11 w-11 place-items-center text-2xl text-[var(--muted)]"
          >
            ×
          </Link>
          <h1 className="text-base font-bold text-[var(--ink-head)]">{t('assets.add')}</h1>
          <div className="h-11 w-11" />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-5 pt-2">
          {/* choose a type */}
          <div>
            <p className="mb-2 text-sm font-semibold text-[var(--muted)]">{t('assets.chooseType')}</p>
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map((ty) => {
                const selected = type === ty
                return (
                  <button
                    type="button"
                    key={ty}
                    onClick={() => setType(ty)}
                    className="pressable min-h-[44px] rounded-xl border px-4 py-3 text-sm font-semibold"
                    style={{
                      borderColor: selected ? 'var(--primary)' : 'var(--hairline)',
                      background: selected ? 'var(--primary)' : 'var(--surface)',
                      color: selected ? 'white' : 'var(--ink)',
                    }}
                  >
                    {t(`assets.type.${ty}`)}
                  </button>
                )
              })}
            </div>
          </div>

          {/* asset name */}
          <div>
            <p className="mb-2 text-sm font-semibold text-[var(--muted)]">{t('assets.name')}</p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={type ? t(`assets.placeholder.${type}`) : t('assets.name')}
              className="w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--ink)] outline-none placeholder:text-[var(--faint)]"
            />
          </div>

          {/* type-specific fields */}
          {type === 'property' && (
            <div className="flex flex-col gap-3">
              <MoneyField label={t('assets.field.startingBalance')} value={startingBalance} onChange={setStartingBalance} />
              <MoneyField label={t('assets.field.monthlyCommitment')} value={monthlyCommitment} onChange={setMonthlyCommitment} />
              <TextField label={t('assets.field.address')} value={address} onChange={setAddress} />
            </div>
          )}
          {type === 'vehicle' && (
            <div className="flex flex-col gap-3">
              <MoneyField label={t('assets.field.loanAmount')} value={loanAmount} onChange={setLoanAmount} />
              <MoneyField label={t('assets.field.installment')} value={installment} onChange={setInstallment} />
              <TextField label={t('assets.field.plate')} value={plate} onChange={setPlate} />
            </div>
          )}
          {type === 'investment' && (
            <div className="flex flex-col gap-3">
              <MoneyField label={t('assets.field.yearlyPremium')} value={yearlyPremium} onChange={setYearlyPremium} />
              <NumberField label={t('assets.field.years')} value={years} onChange={setYears} />
              <div>
                <p className="mb-2 text-sm font-semibold text-[var(--muted)]">{t('assets.field.holder')}</p>
                <div className="flex gap-2">
                  {MEMBERS.map((m) => {
                    const selected = holder === m
                    const memberColor = m === 'CH' ? 'var(--member-ch)' : 'var(--member-jc)'
                    return (
                      <button
                        type="button"
                        key={m}
                        onClick={() => setHolder((h) => (h === m ? null : m))}
                        className="pressable flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 font-semibold"
                        style={{
                          borderColor: selected ? memberColor : 'var(--hairline)',
                          background: selected ? memberColor : 'var(--surface)',
                          color: selected ? 'white' : 'var(--ink)',
                        }}
                      >
                        <MemberAvatar member={m} size={24} />
                        {m}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
          {type === 'other' && (
            <div className="flex flex-col gap-3">
              <MoneyField label={t('assets.field.startingBalance')} value={startingBalance} onChange={setStartingBalance} />
              <TextField label={t('assets.field.notes')} value={notes} onChange={setNotes} />
            </div>
          )}

          {error && <p className="text-sm font-semibold text-[var(--danger)]">{t(`error.${error}`)}</p>}

          <div className="flex-1" />

          <button
            type="submit"
            disabled={!canSubmit}
            aria-busy={submitting}
            className="pressable flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary-btn)] py-3.5 font-bold text-white disabled:opacity-40"
          >
            {submitting && <Spinner />}
            {t('assets.create')}
          </button>
        </form>
      </div>
    </div>
  )
}

function MoneyField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-semibold text-[var(--muted)]">{label}</span>
      <div className="flex items-center gap-2 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3">
        <span className="text-sm font-semibold text-[var(--muted)]">RM</span>
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0.00"
          className="flex-1 bg-transparent text-base text-[var(--ink)] outline-none placeholder:text-[var(--faint)]"
        />
      </div>
    </label>
  )
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-semibold text-[var(--muted)]">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--ink)] outline-none placeholder:text-[var(--faint)]"
      />
    </label>
  )
}

function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-semibold text-[var(--muted)]">{label}</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--ink)] outline-none placeholder:text-[var(--faint)]"
      />
    </label>
  )
}
