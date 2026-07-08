'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronUp, ChevronDown, Trash2, Plus } from 'lucide-react'
import { useT } from '@/i18n/LocaleProvider'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { parseMoneyInput } from '@/lib/money'
import { moveItem, type CommitmentRow } from '@/lib/data/commitments-shared'
import { createCommitment, updateCommitment, deleteCommitment, reorderCommitments } from './actions'

export function CommitmentsManager({ assetId, commitments }: { assetId: string; commitments: CommitmentRow[] }) {
  const t = useT()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true)
    setError(null)
    const res = await fn()
    setBusy(false)
    if (!res.ok) { setError(res.error ?? 'save_failed'); return }
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-5 pb-6">
      <header className="flex items-center gap-3">
        <Link
          href={`/assets/${assetId}`}
          aria-label={t('common.back')}
          className="pressable-opacity grid h-11 w-11 shrink-0 place-items-center text-2xl text-[var(--muted)]"
        >
          ‹
        </Link>
        <h1 className="flex-1 truncate text-xl font-extrabold text-[var(--ink-head)]">{t('asset.commitments.title')}</h1>
      </header>

      {error && (
        <p role="alert" className="rounded-xl bg-[var(--pending-bg)] px-4 py-2 text-sm font-semibold text-[var(--danger)]">
          {t(`error.${error}`)}
        </p>
      )}

      <section className="flex flex-col gap-2">
        {commitments.map((c, i) => (
          <CommitmentEditor
            key={c.id}
            row={c}
            disabled={busy}
            canUp={i > 0}
            canDown={i < commitments.length - 1}
            onSave={(name, amountCents, remark) => run(() => updateCommitment({ id: c.id, assetId, name, amountCents, remark }))}
            onDelete={() => run(() => deleteCommitment({ id: c.id, assetId }))}
            onMove={(delta) => run(() => reorderCommitments({ assetId, orderedIds: moveItem(commitments, i, delta).map((x) => x.id) }))}
          />
        ))}
        <CommitmentAdder
          disabled={busy}
          onAdd={(name, amountCents, remark) => run(() => createCommitment({ assetId, name, amountCents, remark }))}
        />
      </section>

      {busy && <div className="flex justify-center py-2"><Spinner /></div>}
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

function CommitmentEditor({ row, disabled, canUp, canDown, onSave, onDelete, onMove }: {
  row: CommitmentRow; disabled: boolean; canUp: boolean; canDown: boolean
  onSave: (name: string, amountCents: number, remark: string | null) => void
  onDelete: () => void; onMove: (delta: -1 | 1) => void
}) {
  const t = useT()
  const [name, setName] = useState(row.name)
  const [remark, setRemark] = useState(row.remark ?? '')
  const [amount, setAmount] = useState((row.amountCents / 100).toFixed(2))
  return (
    <Card className="flex items-start gap-2">
      <MoveButtons canUp={canUp} canDown={canDown} disabled={disabled} onMove={onMove} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('asset.commitments.name')}
          className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--ink)] outline-none placeholder:text-[var(--faint)]" />
        <input value={remark} onChange={(e) => setRemark(e.target.value)} placeholder={t('asset.commitments.remarkOptional')}
          className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--faint)]" />
        <div className="flex items-center gap-2">
          <div className="flex w-24 shrink-0 items-center gap-1 rounded-lg border border-[var(--hairline)] bg-[var(--surface)] px-2 py-2">
            <span className="text-xs text-[var(--muted)]">RM</span>
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-transparent text-sm text-[var(--ink)] outline-none" />
          </div>
          <button type="button" disabled={disabled} onClick={() => onSave(name, parseMoneyInput(amount), remark.trim() || null)}
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

function CommitmentAdder({ disabled, onAdd }: { disabled: boolean; onAdd: (name: string, amountCents: number, remark: string | null) => void }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [remark, setRemark] = useState('')
  const [amount, setAmount] = useState('')
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="pressable flex min-h-[44px] w-full items-center justify-center gap-1 rounded-xl border border-dashed border-[var(--primary)] py-3 text-sm font-bold text-[var(--primary)]">
        <Plus size={16} /> {t('asset.commitments.add')}
      </button>
    )
  }
  return (
    <Card className="flex flex-col gap-2">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('asset.commitments.name')}
        className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--faint)]" />
      <input value={remark} onChange={(e) => setRemark(e.target.value)} placeholder={t('asset.commitments.remarkOptional')}
        className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--faint)]" />
      <div className="flex items-center gap-2 rounded-lg border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2">
        <span className="text-xs text-[var(--muted)]">RM</span>
        <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
          className="flex-1 bg-transparent text-sm text-[var(--ink)] outline-none" />
      </div>
      <div className="flex gap-2">
        <button type="button" disabled={disabled || !name.trim()}
          onClick={() => { onAdd(name, parseMoneyInput(amount), remark.trim() || null); setOpen(false); setName(''); setRemark(''); setAmount('') }}
          className="pressable min-h-[40px] flex-1 rounded-lg bg-[var(--primary-btn)] text-sm font-bold text-white disabled:opacity-40">
          {t('asset.commitments.addConfirm')}
        </button>
        <button type="button" onClick={() => setOpen(false)} aria-label={t('common.close')}
          className="pressable-opacity grid h-10 w-10 place-items-center text-xl text-[var(--muted)]">×</button>
      </div>
    </Card>
  )
}
