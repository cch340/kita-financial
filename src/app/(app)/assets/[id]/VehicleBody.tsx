import Link from 'next/link'
import { Pencil } from 'lucide-react'
import { t, type Locale } from '@/i18n'
import { nextPaymentCents, groupByTxnType } from '@/lib/data/assets-shared'
import type { AssetTxn } from '@/lib/data/assets-shared'
import { Card } from '@/components/ui/Card'
import { MoneyText } from '@/components/ui/MoneyText'
import { StatusChip } from '@/components/ui/StatusChip'

const KNOWN_TXN_TYPES = new Set(['loan', 'road_tax_insurance', 'maintenance', 'loan_payback', 'other'])

function txnTypeLabel(locale: Locale, txnType: string): string {
  if (KNOWN_TXN_TYPES.has(txnType)) return t(locale, `asset.txnType.${txnType}`)
  return txnType
}

// No 'use client' here: this body has no interactivity of its own, so it stays a
// server component (locale is pre-resolved by the parent and passed down, rather
// than reading it via useLocale()/useT() — keeps this file free of client-only hooks).
export function VehicleBody({ txns, locale, assetId }: { txns: AssetTxn[]; locale: Locale; assetId: string }) {
  const nextPayment = nextPaymentCents(txns)
  const groups = groupByTxnType(txns)

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[26px] p-5 text-white" style={{ background: 'var(--member-jc)' }}>
        <span className="text-sm font-bold opacity-90">{t(locale, 'asset.nextPayment')}</span>
        <div className="mt-1">
          {nextPayment > 0 ? (
            <MoneyText cents={nextPayment} className="text-[32px] font-extrabold" />
          ) : (
            <p className="text-lg font-bold opacity-90">{t(locale, 'asset.paidUp')}</p>
          )}
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="py-10 text-center text-sm font-semibold text-[var(--faint)]">{t(locale, 'asset.empty')}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((g) => (
            <div key={g.txnType} className="flex flex-col gap-2">
              <span className="px-1 text-xs font-bold tracking-wide text-[var(--muted)] uppercase">
                {txnTypeLabel(locale, g.txnType)}
              </span>
              <Card className="overflow-hidden p-0">
                {g.rows.map((row, i) => (
                  <div
                    key={row.id}
                    className={`flex items-center gap-3 px-4 py-3 ${
                      i < g.rows.length - 1 ? 'border-b border-[var(--hairline)]' : ''
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--ink)]">
                        {row.description ?? txnTypeLabel(locale, g.txnType)}
                      </p>
                      <p className="text-xs text-[var(--muted)]">
                        {row.date}
                        {row.seq != null ? ` · #${row.seq}` : ''}
                      </p>
                    </div>
                    <MoneyText cents={row.amountCents} className="shrink-0 text-sm font-bold text-[var(--ink-head)]" />
                    <StatusChip status={row.settled ? 'paid' : 'upcoming'} />
                    <Link
                      href={`/assets/${assetId}/txn/${row.id}`}
                      aria-label={t(locale, 'asset.editTxn')}
                      className="pressable-opacity grid h-8 w-8 shrink-0 place-items-center text-[var(--muted)]"
                    >
                      <Pencil size={15} />
                    </Link>
                  </div>
                ))}
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
