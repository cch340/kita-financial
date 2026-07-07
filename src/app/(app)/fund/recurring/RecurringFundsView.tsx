'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useT } from '@/i18n/LocaleProvider'
import { parseMoneyInput } from '@/lib/money'
import { sumForMember } from '@/lib/data/recurring-funds-shared'
import type { RecurringFund, Member } from '@/lib/data/recurring-funds-shared'
import { Card } from '@/components/ui/Card'
import { MemberAvatar } from '@/components/ui/MemberAvatar'
import { MoneyText } from '@/components/ui/MoneyText'
import { createRecurringAction, updateRecurringAction, deleteRecurringAction } from './actions'

const MEMBERS: Member[] = ['CH', 'JC']

export function RecurringFundsView({ funds }: { funds: RecurringFund[] }) {
  const t = useT()
  const router = useRouter()
  const [editing, setEditing] = useState<RecurringFund | 'new' | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete(id: string) {
    if (busy || !confirm(t('recurring.deleteConfirm'))) return
    setBusy(true)
    await deleteRecurringAction(id)
    router.refresh()
    setBusy(false)
  }

  return (
    <div className="flex flex-col gap-5 pb-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/fund" aria-label={t('common.back')}
            className="pressable-opacity grid h-11 w-11 place-items-center text-2xl text-[var(--muted)]">‹</Link>
          <h1 className="text-2xl font-extrabold text-[var(--ink-head)]">{t('recurring.title')}</h1>
        </div>
        <button type="button" onClick={() => { setError(null); setEditing('new') }}
          aria-label={t('recurring.add')}
          className="pressable grid h-11 w-11 place-items-center rounded-full bg-[var(--primary)] text-white">
          <Plus size={18} />
        </button>
      </header>

      {MEMBERS.map((mem) => {
        const rows = funds.filter((f) => f.memberCode === mem)
        return (
          <Card key={mem} className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-[var(--hairline)] px-4 py-3">
              <span className="flex items-center gap-2 font-bold text-[var(--ink-head)]">
                <MemberAvatar member={mem} size={28} />{mem}
              </span>
              <span className="text-sm font-bold text-[var(--muted)]">
                {t('recurring.monthlyTotal')} · <MoneyText cents={sumForMember(mem, funds)} />
              </span>
            </div>
            {rows.length === 0 ? (
              <p className="px-4 py-4 text-sm text-[var(--faint)]">{t('recurring.empty')}</p>
            ) : rows.map((f, i) => (
              <div key={f.id}
                className={`flex items-center justify-between gap-3 px-4 py-3 ${i < rows.length - 1 ? 'border-b border-[var(--hairline)]' : ''}`}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-[var(--ink-head)]">{f.name}</p>
                  {f.remark && <p className="truncate text-xs text-[var(--muted)]">{f.remark}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <MoneyText cents={f.amountCents} className="text-sm font-bold" />
                  <button type="button" onClick={() => { setError(null); setEditing(f) }} aria-label={t('recurring.edit')}
                    className="pressable-opacity grid h-9 w-9 place-items-center rounded-full text-[var(--muted)]"><Pencil size={15} /></button>
                  <button type="button" onClick={() => handleDelete(f.id)} aria-label={t('fund.delete')}
                    className="pressable-opacity grid h-9 w-9 place-items-center rounded-full text-[var(--danger)]"><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
          </Card>
        )
      })}

      {editing && (
        <RecurringEditor
          fund={editing === 'new' ? null : editing}
          busy={busy} error={error}
          onCancel={() => setEditing(null)}
          onSubmit={async (payload) => {
            setBusy(true); setError(null)
            const res = editing === 'new'
              ? await createRecurringAction(payload)
              : await updateRecurringAction((editing as RecurringFund).id,
                  { name: payload.name, amountCents: payload.amountCents, remark: payload.remark })
            setBusy(false)
            if (!res.ok) { setError(res.error ?? 'save_failed'); return }
            setEditing(null); router.refresh()
          }}
          t={t}
        />
      )}
    </div>
  )
}

function RecurringEditor({
  fund, busy, error, onCancel, onSubmit, t,
}: {
  fund: RecurringFund | null
  busy: boolean
  error: string | null
  onCancel: () => void
  onSubmit: (p: { name: string; amountCents: number; remark: string | null; members: Member[] }) => void
  t: (k: string) => string
}) {
  const [name, setName] = useState(fund?.name ?? '')
  const [amount, setAmount] = useState(fund ? (fund.amountCents / 100).toString() : '')
  const [remark, setRemark] = useState(fund?.remark ?? '')
  const [members, setMembers] = useState<Member[]>(fund ? [fund.memberCode] : [])
  const isNew = fund === null

  function toggle(mem: Member) {
    setMembers((cur) => (cur.includes(mem) ? cur.filter((x) => x !== mem) : [...cur, mem]))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/30" onClick={onCancel}>
      <div className="mx-auto w-full max-w-[430px] rounded-t-2xl bg-[var(--paper)] p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-bold text-[var(--ink-head)]">{t(isNew ? 'recurring.add' : 'recurring.edit')}</h2>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-[var(--muted)]">{t('recurring.name')}</span>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="min-h-[44px] rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 text-base text-[var(--ink)] outline-none" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-[var(--muted)]">{t('recurring.amount')}</span>
            <input type="number" inputMode="decimal" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
              className="min-h-[44px] rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 text-base text-[var(--ink)] outline-none" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-[var(--muted)]">{t('recurring.remark')}</span>
            <input value={remark} onChange={(e) => setRemark(e.target.value)}
              className="min-h-[44px] rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 text-base text-[var(--ink)] outline-none" />
          </label>
          {isNew && (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-[var(--muted)]">{t('recurring.members')}</span>
              <div className="flex gap-2">
                {MEMBERS.map((mem) => {
                  const on = members.includes(mem)
                  const color = mem === 'CH' ? 'var(--member-ch)' : 'var(--member-jc)'
                  return (
                    <button type="button" key={mem} onClick={() => toggle(mem)}
                      className="pressable flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 font-semibold"
                      style={{ borderColor: on ? color : 'var(--hairline)', background: on ? color : 'var(--surface)', color: on ? 'white' : 'var(--ink)' }}>
                      <MemberAvatar member={mem} size={22} />{mem}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          {error && <p className="text-sm font-semibold text-[var(--danger)]">{t(`error.${error}`)}</p>}
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={onCancel}
              className="pressable flex-1 rounded-xl border border-[var(--hairline)] py-3 font-bold text-[var(--ink)]">{t('common.close')}</button>
            <button type="button" disabled={busy}
              onClick={() => onSubmit({ name: name.trim(), amountCents: parseMoneyInput(amount), remark: remark.trim() || null, members })}
              className="pressable flex-1 rounded-xl bg-[var(--primary-btn)] py-3 font-bold text-white disabled:opacity-40">{t('fund.save')}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
