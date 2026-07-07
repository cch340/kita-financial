'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useT } from '@/i18n/LocaleProvider'
import { formatRM, parseMoneyInput } from '@/lib/money'
import { sumForMember } from '@/lib/data/recurring-funds-shared'
import type { RecurringFund, Member } from '@/lib/data/recurring-funds-shared'
import { MemberAvatar } from '@/components/ui/MemberAvatar'
import { SubmitButton } from '@/components/ui/SubmitButton'

const MEMBERS: Member[] = ['CH', 'JC']

export type FundRecordFormValues = {
  id?: string
  memberCode: Member | null
  year: number
  month: number
  amountCents: number
  notes: string
}

export function FundRecordForm({
  mode, action, error, recurringFunds, initial,
}: {
  mode: 'add' | 'edit'
  action: (formData: FormData) => void
  error?: string
  recurringFunds: RecurringFund[]
  initial: FundRecordFormValues
}) {
  const t = useT()
  const [payer, setPayer] = useState<Member | null>(initial.memberCode)
  // In add mode the amount tracks the payer's recurring sum until the user edits it.
  const [amount, setAmount] = useState(initial.amountCents ? (initial.amountCents / 100).toString() : '')
  const [touched, setTouched] = useState(mode === 'edit')
  const [year, setYear] = useState(initial.year)
  const [month, setMonth] = useState(initial.month)
  const [notes, setNotes] = useState(initial.notes)

  function selectPayer(mem: Member) {
    setPayer(mem)
    if (!touched) setAmount((sumForMember(mem, recurringFunds) / 100).toString())
  }

  const cents = parseMoneyInput(amount)
  const years = [year - 1, year, year + 1].filter((v, i, a) => a.indexOf(v) === i)

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--paper)]">
      <div className="mx-auto flex min-h-0 w-full max-w-[430px] flex-1 flex-col px-[18px] pb-6 pt-4">
        <div className="flex items-center justify-between py-2">
          <Link href="/fund" aria-label={t('common.back')}
            className="pressable-opacity grid h-11 w-11 place-items-center text-2xl text-[var(--muted)]">‹</Link>
          <h1 className="text-base font-bold text-[var(--ink-head)]">{t(mode === 'add' ? 'fund.addRecord' : 'fund.editRecord')}</h1>
          <Link href="/fund" aria-label={t('common.close')}
            className="pressable-opacity grid h-11 w-11 place-items-center text-2xl text-[var(--muted)]">×</Link>
        </div>

        <form action={action} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
          {initial.id && <input type="hidden" name="id" value={initial.id} />}
          <input type="hidden" name="memberCode" value={payer ?? ''} />
          <input type="hidden" name="amountCents" value={cents} />
          <input type="hidden" name="year" value={year} />
          <input type="hidden" name="month" value={month} />
          <input type="hidden" name="notes" value={notes} />

          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-[var(--muted)]">{t('fund.paidBy')}</span>
            <div className="flex gap-2">
              {MEMBERS.map((mem) => {
                const on = payer === mem
                const color = mem === 'CH' ? 'var(--member-ch)' : 'var(--member-jc)'
                return (
                  <button type="button" key={mem} onClick={() => selectPayer(mem)}
                    className="pressable flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 font-semibold"
                    style={{ borderColor: on ? color : 'var(--hairline)', background: on ? color : 'var(--surface)', color: on ? 'white' : 'var(--ink)' }}>
                    <MemberAvatar member={mem} size={22} />{mem}
                  </button>
                )
              })}
            </div>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-[var(--muted)]">{t('fund.amount')}</span>
            <input type="number" inputMode="decimal" step="0.01" value={amount}
              onChange={(e) => { setTouched(true); setAmount(e.target.value) }}
              className="min-h-[44px] rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 text-base text-[var(--ink)] outline-none" />
            <span className="text-xs text-[var(--faint)]">{formatRM(cents)}</span>
          </label>

          <div className="flex gap-2">
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-xs font-semibold text-[var(--muted)]">{t('fund.month')}</span>
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
                className="min-h-[44px] rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-3 text-base text-[var(--ink)] outline-none">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((mo) => (
                  <option key={mo} value={mo}>{mo}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-xs font-semibold text-[var(--muted)]">{t('fund.year')}</span>
              <select value={year} onChange={(e) => setYear(Number(e.target.value))}
                className="min-h-[44px] rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-3 text-base text-[var(--ink)] outline-none">
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-[var(--muted)]">{t('fund.note')}</span>
            <input value={notes} onChange={(e) => setNotes(e.target.value)}
              className="min-h-[44px] rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 text-base text-[var(--ink)] outline-none" />
          </label>

          {error && <p className="text-sm font-semibold text-[var(--danger)]">{t(`error.${error}`)}</p>}

          <div className="mt-auto pt-2">
            <SubmitButton disabled={!payer || cents <= 0}
              className="w-full rounded-xl bg-[var(--primary-btn)] py-3.5 font-bold text-white disabled:opacity-40">
              {t('fund.save')}
            </SubmitButton>
          </div>
        </form>
      </div>
    </div>
  )
}
