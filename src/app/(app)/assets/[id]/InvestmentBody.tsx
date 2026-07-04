import { t, type Locale } from '@/i18n'
import { totalSettledOutCents } from '@/lib/data/assets-shared'
import type { AssetTxn } from '@/lib/data/assets-shared'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { MoneyText } from '@/components/ui/MoneyText'
import { StatusChip } from '@/components/ui/StatusChip'

function sortSchedule(txns: AssetTxn[]): AssetTxn[] {
  return txns.slice().sort((a, b) => {
    if (a.seq != null && b.seq != null) return a.seq - b.seq
    if (a.seq != null) return -1
    if (b.seq != null) return 1
    return a.date < b.date ? -1 : 1
  })
}

// Server component like VehicleBody — no hooks, locale passed in from the page.
export function InvestmentBody({ txns, locale }: { txns: AssetTxn[]; locale: Locale }) {
  const paid = totalSettledOutCents(txns)
  const sumAll = txns.reduce((a, tx) => a + tx.amountCents, 0)
  const progress = sumAll > 0 ? paid / sumAll : 0
  const schedule = sortSchedule(txns)

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[26px] p-5" style={{ background: 'var(--positive-bg)', color: 'var(--positive-text)' }}>
        <span className="text-sm font-bold opacity-90">{t(locale, 'asset.totalPaid')}</span>
        <div className="mt-1">
          <MoneyText cents={paid} className="text-[32px] font-extrabold" />
        </div>
        <p className="mt-1 flex items-center gap-1 text-sm font-semibold opacity-80">
          {t(locale, 'asset.of')} <MoneyText cents={sumAll} />
        </p>
        <div className="mt-3">
          <ProgressBar value={progress} trackClassName="bg-black/10" barClassName="bg-[var(--positive-text)]" />
        </div>
      </div>

      {schedule.length === 0 ? (
        <p className="py-10 text-center text-sm font-semibold text-[var(--faint)]">{t(locale, 'asset.empty')}</p>
      ) : (
        <Card className="overflow-hidden p-0">
          {schedule.map((row, i) => (
            <div
              key={row.id}
              className={`flex items-center gap-3 px-4 py-3 ${
                i < schedule.length - 1 ? 'border-b border-[var(--hairline)]' : ''
              }`}
            >
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                style={
                  row.settled
                    ? { background: 'var(--positive-text)', color: 'white' }
                    : { background: 'transparent', border: '1.5px solid var(--pending-text)', color: 'var(--pending-text)' }
                }
              >
                {row.seq ?? i + 1}
              </span>
              <span className="flex-1 text-sm font-bold text-[var(--ink-head)]">{row.date.slice(0, 4)}</span>
              <StatusChip status={row.settled ? 'paid' : 'upcoming'} />
              <MoneyText cents={row.amountCents} className="shrink-0 text-sm font-bold text-[var(--ink-head)] tabular-nums" />
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}
