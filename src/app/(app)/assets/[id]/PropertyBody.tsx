'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowDown, ArrowUp, Pencil, ChevronDown, SlidersHorizontal } from 'lucide-react'
import { useT } from '@/i18n/LocaleProvider'
import { HeroCard, Card } from '@/components/ui/Card'
import { MoneyText } from '@/components/ui/MoneyText'
import { runningBalanceCents } from '@/lib/data/assets-shared'
import type { Asset, AssetTxn } from '@/lib/data/assets-shared'
import type { Commitment } from '@/lib/data/commitments-shared'
import { toggleTransferred } from '@/app/(app)/assets/actions'

export function PropertyBody({ asset, txns, commitments }: { asset: Asset; txns: AssetTxn[]; commitments: Commitment[] }) {
  const t = useT()
  const router = useRouter()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [errorId, setErrorId] = useState<string | null>(null)

  const balance = runningBalanceCents(asset.openingBalanceCents, txns)

  async function handleToggle(txnId: string) {
    setErrorId(null)
    setPendingId(txnId)
    const res = await toggleTransferred(txnId)
    setPendingId(null)
    if (!res.ok) {
      setErrorId(txnId)
      return
    }
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-4">
      <HeroCard>
        <span className="text-sm font-bold opacity-90">{t('asset.balance')}</span>
        <div className="mt-1">
          <MoneyText cents={balance} className="text-[32px] font-extrabold" />
        </div>
      </HeroCard>

      <CommitmentsSection assetId={asset.id} commitments={commitments} />

      {txns.length === 0 ? (
        <p className="py-10 text-center text-sm font-semibold text-[var(--faint)]">{t('asset.empty')}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {txns.map((txn) => {
            const color = txn.direction === 'in' ? 'var(--positive-text)' : 'var(--primary)'
            return (
              <Card key={txn.id} className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  {txn.direction === 'in' ? (
                    <ArrowDown size={18} strokeWidth={2.5} className="shrink-0" style={{ color }} />
                  ) : (
                    <ArrowUp size={18} strokeWidth={2.5} className="shrink-0" style={{ color }} />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--ink)]">{txn.description ?? '—'}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {txn.date} · {t(txn.direction === 'in' ? 'asset.in' : 'asset.out')}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-bold tabular-nums" style={{ color }}>
                    {txn.direction === 'in' ? '+' : '−'} <MoneyText cents={txn.amountCents} />
                  </span>
                  <Link
                    href={`/assets/${asset.id}/txn/${txn.id}`}
                    aria-label={t('asset.editTxn')}
                    className="pressable-opacity grid h-8 w-8 shrink-0 place-items-center text-[var(--muted)]"
                  >
                    <Pencil size={15} />
                  </Link>
                </div>

                <div className="flex items-center justify-between border-t border-[var(--hairline)] pt-3">
                  <span className="text-sm font-semibold text-[var(--muted)]">{t('asset.transferred')}</span>
                  <Switch
                    checked={txn.settled}
                    disabled={pendingId === txn.id}
                    onChange={() => handleToggle(txn.id)}
                  />
                </div>
                {errorId === txn.id && (
                  <p role="alert" className="text-xs font-semibold text-[var(--danger)]">
                    {t('error.save_failed')}
                  </p>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Switch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className="pressable-opacity flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center disabled:opacity-50"
    >
      <span
        className="relative inline-block h-7 w-12 rounded-full transition-colors"
        style={{ background: checked ? 'var(--positive-text)' : 'var(--hairline)' }}
      >
        <span
          className="absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform"
          style={{ transform: checked ? 'translateX(22px)' : 'translateX(4px)' }}
        />
      </span>
    </button>
  )
}

function CommitmentsSection({ assetId, commitments }: { assetId: string; commitments: Commitment[] }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const total = commitments.reduce((a, c) => a + c.amountCents, 0)
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="pressable-opacity flex min-w-0 flex-1 items-center gap-2"
        >
          <ChevronDown
            size={16}
            strokeWidth={2.5}
            className="shrink-0 text-[var(--muted)] transition-transform"
            style={{ transform: open ? 'none' : 'rotate(-90deg)' }}
          />
          <span className="truncate text-sm font-bold text-[var(--ink-head)]">{t('asset.commitments.title')}</span>
          {!open && commitments.length > 0 && (
            <MoneyText cents={total} className="shrink-0 text-sm font-bold text-[var(--muted)]" />
          )}
        </button>
        <Link
          href={`/assets/${assetId}/commitments`}
          aria-label={t('common.manage')}
          className="pressable-opacity flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-3 text-sm font-bold text-[var(--ink)]"
        >
          <SlidersHorizontal size={16} />
          {t('common.manage')}
        </Link>
      </div>

      {open &&
        (commitments.length === 0 ? (
          <p className="border-t border-[var(--hairline)] px-4 py-6 text-center text-sm font-semibold text-[var(--faint)]">
            {t('asset.commitments.empty')}
          </p>
        ) : (
          <>
            {commitments.map((c, i) => (
              <div key={i} className="flex items-center justify-between border-t border-[var(--hairline)] px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--ink-head)]">{c.name}</p>
                  {c.remark && <p className="truncate text-xs text-[var(--muted)]">{c.remark}</p>}
                </div>
                <MoneyText cents={c.amountCents} className="shrink-0 text-sm font-bold text-[var(--ink-head)]" />
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-[var(--hairline)] bg-[var(--subtle)] px-4 py-3">
              <span className="text-sm font-bold text-[var(--ink-head)]">{t('asset.commitments.total')}</span>
              <MoneyText cents={total} className="text-sm font-extrabold text-[var(--ink-head)]" />
            </div>
          </>
        ))}
    </Card>
  )
}
