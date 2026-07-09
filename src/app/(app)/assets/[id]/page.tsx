import Link from 'next/link'
import { Download } from 'lucide-react'
import { notFound } from 'next/navigation'
import { getAsset } from '@/lib/data/assets'
import { getCommitments } from '@/lib/data/commitments'
import type { Commitment } from '@/lib/data/commitments-shared'
import { getMembership } from '@/lib/data/household'
import { t, type Locale } from '@/i18n'
import { AssetBody } from './AssetBody'
import { AddTxn } from './AddTxn'

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [result, membership] = await Promise.all([getAsset(id), getMembership()])
  if (!result) notFound()
  const { asset, txns, categories } = result
  const commitments: Commitment[] = await getCommitments(asset.id)
  const locale: Locale = membership?.language ?? 'en'

  const defaultDirection: 'in' | 'out' = asset.type === 'property' ? 'in' : 'out'

  return (
    <div className="flex flex-col gap-5 pb-28">
      <header className="flex items-center gap-3">
        <Link href="/assets" aria-label={t(locale, 'common.back')}
          className="pressable-opacity grid h-11 w-11 shrink-0 place-items-center text-2xl text-[var(--muted)]">‹</Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-extrabold text-[var(--ink-head)]">{asset.name}</h1>
          <p className="truncate text-xs font-semibold text-[var(--muted)]">
            {t(locale, `assets.type.${asset.type}`)}
            {asset.status === 'closed' ? ` · ${t(locale, 'assets.closed')}` : ''}
          </p>
        </div>
        <a href={`/report/export?type=asset&id=${asset.id}`} download
          className="pressable-opacity flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-3 text-sm font-bold text-[var(--ink)]">
          <Download size={16} className="text-[var(--muted)]" />
          {t(locale, 'asset.exportCsv')}
        </a>
      </header>

      <AssetBody asset={asset} txns={txns} categories={categories} commitments={commitments} />

      <AddTxn assetId={asset.id} assetType={asset.type} categories={categories} defaultDirection={defaultDirection} />
    </div>
  )
}
