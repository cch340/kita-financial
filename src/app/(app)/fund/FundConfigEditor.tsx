'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/i18n/LocaleProvider'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { MemberAvatar } from '@/components/ui/MemberAvatar'
import { parseMoneyInput } from '@/lib/money'
import type { FundConfig } from '@/lib/data/fund'
import { updateFundConfig } from './actions'

export function FundConfigEditor({ config, onClose }: { config: FundConfig; onClose: () => void }) {
  const t = useT()
  const router = useRouter()
  const [chMonthly, setChMonthly] = useState((config.CH.expectedMonthlyCents / 100).toFixed(2))
  const [chCarry, setChCarry] = useState((config.CH.carryForwardCents / 100).toFixed(2))
  const [jcMonthly, setJcMonthly] = useState((config.JC.expectedMonthlyCents / 100).toFixed(2))
  const [jcCarry, setJcCarry] = useState((config.JC.carryForwardCents / 100).toFixed(2))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setBusy(true)
    setError(null)
    const res = await updateFundConfig({
      CH: { expectedMonthlyCents: parseMoneyInput(chMonthly), carryForwardCents: parseMoneyInput(chCarry) },
      JC: { expectedMonthlyCents: parseMoneyInput(jcMonthly), carryForwardCents: parseMoneyInput(jcCarry) },
    })
    setBusy(false)
    if (!res.ok) { setError(res.error ?? 'save_failed'); return }
    onClose()
    router.refresh()
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-[var(--ink-head)]">{t('fund.editConfig')}</span>
        <button type="button" onClick={onClose} aria-label={t('common.close')}
          className="pressable-opacity grid h-11 w-11 place-items-center text-xl text-[var(--muted)]">×</button>
      </div>
      {(['CH', 'JC'] as const).map((code) => {
        const monthly = code === 'CH' ? chMonthly : jcMonthly
        const setMonthly = code === 'CH' ? setChMonthly : setJcMonthly
        const carry = code === 'CH' ? chCarry : jcCarry
        const setCarry = code === 'CH' ? setChCarry : setJcCarry
        return (
          <div key={code} className="flex flex-col gap-2 border-t border-[var(--hairline)] pt-3 first:border-t-0 first:pt-0">
            <div className="flex items-center gap-2">
              <MemberAvatar member={code} size={24} />
              <span className="text-sm font-bold text-[var(--ink-head)]">{code}</span>
            </div>
            <ConfigField label={t('fund.expectedMonthly')} value={monthly} onChange={setMonthly} />
            <ConfigField label={t('fund.carryForward')} value={carry} onChange={setCarry} />
          </div>
        )
      })}
      {error && <p role="alert" className="text-sm font-semibold text-[var(--danger)]">{t(`error.${error}`)}</p>}
      <button type="button" onClick={save} disabled={busy} aria-busy={busy}
        className="pressable flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary-btn)] py-3 text-sm font-bold text-white disabled:opacity-40">
        {busy && <Spinner size={16} />}
        {t('personal.save')}
      </button>
    </Card>
  )
}

function ConfigField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-[var(--muted)]">{label}</span>
      <div className="flex items-center gap-2 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3">
        <span className="text-sm font-semibold text-[var(--muted)]">RM</span>
        <input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} placeholder="0.00"
          className="flex-1 bg-transparent text-base text-[var(--ink)] outline-none placeholder:text-[var(--faint)]" />
      </div>
    </label>
  )
}
