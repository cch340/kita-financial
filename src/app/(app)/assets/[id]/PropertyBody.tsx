'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { useT } from '@/i18n/LocaleProvider'
import { HeroCard, Card } from '@/components/ui/Card'
import { MoneyText } from '@/components/ui/MoneyText'
import { runningBalanceCents } from '@/lib/data/assets-shared'
import type { Asset, AssetTxn } from '@/lib/data/assets-shared'
import { toggleTransferred } from '@/app/(app)/assets/actions'

export function PropertyBody({ asset, txns }: { asset: Asset; txns: AssetTxn[] }) {
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
      className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center disabled:opacity-50"
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
