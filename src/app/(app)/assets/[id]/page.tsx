import Link from 'next/link'
import { Pencil, Download } from 'lucide-react'
import { notFound } from 'next/navigation'
import { getAsset } from '@/lib/data/assets'
import { getCommitments } from '@/lib/data/commitments'
import type { Commitment } from '@/lib/data/commitments-shared'
import { getMembership } from '@/lib/data/household'
import { t, type Locale } from '@/i18n'
import type { AssetTxn } from '@/lib/data/assets-shared'
import { Card } from '@/components/ui/Card'
import { MoneyText } from '@/components/ui/MoneyText'
import { PropertyBody } from './PropertyBody'
import { VehicleBody } from './VehicleBody'
import { InvestmentBody } from './InvestmentBody'
import { AddTxn } from './AddTxn'

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [result, membership] = await Promise.all([getAsset(id), getMembership()])
  if (!result) notFound()
  const { asset, txns } = result
  const commitments: Commitment[] = asset.type === 'property' ? await getCommitments(asset.id) : []
  const locale: Locale = membership?.language ?? 'en'

  const defaultDirection: 'in' | 'out' = asset.type === 'property' ? 'in' : 'out'

  return (
    <div className="flex flex-col gap-5 pb-28">
      <header className="flex items-center gap-3">
        <Link
          href="/assets"
          aria-label={t(locale, 'common.back')}
          className="pressable-opacity grid h-11 w-11 shrink-0 place-items-center text-2xl text-[var(--muted)]"
        >
          ‹
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-extrabold text-[var(--ink-head)]">{asset.name}</h1>
          <p className="truncate text-xs font-semibold text-[var(--muted)]">
            {t(locale, `assets.type.${asset.type}`)}
            {asset.status === 'closed' ? ` · ${t(locale, 'assets.closed')}` : ''}
          </p>
        </div>
        <a
          href={`/report/export?type=asset&id=${asset.id}`}
          download
          aria-label={t(locale, 'asset.exportCsv')}
          className="pressable-opacity grid h-11 w-11 shrink-0 place-items-center text-[var(--muted)]"
        >
          <Download size={18} />
        </a>
      </header>

      {asset.type === 'property' && <PropertyBody asset={asset} txns={txns} commitments={commitments} />}
      {asset.type === 'vehicle' && <VehicleBody txns={txns} locale={locale} assetId={asset.id} />}
      {asset.type === 'investment' && <InvestmentBody txns={txns} locale={locale} assetId={asset.id} />}
      {asset.type === 'other' && <GenericBody txns={txns} locale={locale} assetId={asset.id} />}

      <AddTxn assetId={asset.id} defaultDirection={defaultDirection} />
    </div>
  )
}

function GenericBody({ txns, locale, assetId }: { txns: AssetTxn[]; locale: Locale; assetId: string }) {
  if (txns.length === 0) {
    return (
      <p className="py-10 text-center text-sm font-semibold text-[var(--faint)]">{t(locale, 'asset.empty')}</p>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      {txns.map((txn) => (
        <Card key={txn.id} className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[var(--ink)]">{txn.description ?? '—'}</p>
            <p className="text-xs text-[var(--muted)]">{txn.date}</p>
          </div>
          <MoneyText cents={txn.amountCents} className="shrink-0 text-sm font-bold text-[var(--ink-head)]" />
          <Link
            href={`/assets/${assetId}/txn/${txn.id}`}
            aria-label={t(locale, 'asset.editTxn')}
            className="pressable-opacity grid h-8 w-8 shrink-0 place-items-center text-[var(--muted)]"
          >
            <Pencil size={15} />
          </Link>
        </Card>
      ))}
    </div>
  )
}
