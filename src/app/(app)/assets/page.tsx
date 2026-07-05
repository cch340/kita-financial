import Link from 'next/link'
import { Plus, ChevronRight } from 'lucide-react'
import { getAssetsList } from '@/lib/data/assets'
import { getMembership } from '@/lib/data/household'
import { t } from '@/i18n'
import type { Asset, AssetType, KeyFigure } from '@/lib/data/assets-shared'
import { splitByStatus } from '@/lib/data/assets-shared'
import { Card } from '@/components/ui/Card'
import { IconTile } from '@/components/ui/IconTile'
import { MoneyText } from '@/components/ui/MoneyText'

const TYPE_ICON: Record<AssetType, string> = {
  property: 'Building',
  vehicle: 'Car',
  investment: 'ShieldCheck',
  other: 'PiggyBank',
}
const TYPE_TINT: Record<AssetType, string> = {
  property: 'var(--peach)',
  vehicle: 'var(--info-bg)',
  investment: 'var(--positive-bg)',
  other: 'var(--subtle)',
}

function assetMetaText(asset: Asset): string | null {
  const md = asset.metadata ?? {}
  if (asset.type === 'property') {
    return typeof md.address === 'string' && md.address.trim() ? md.address : null
  }
  if (asset.type === 'vehicle') {
    return typeof md.plate === 'string' && md.plate.trim() ? md.plate : null
  }
  if (asset.type === 'investment') {
    const years = md.years
    if (typeof years === 'number' && years > 0) return `${years}-year plan`
    return asset.ownerMemberCode
  }
  // other
  return typeof md.notes === 'string' && md.notes.trim() ? md.notes : null
}

export default async function AssetsPage() {
  const [groups, membership] = await Promise.all([getAssetsList(), getMembership()])
  const locale = membership?.language ?? 'en'

  const activeGroups = groups
    .map((g) => ({ type: g.type, assets: splitByStatus(g.assets).active }))
    .filter((g) => g.assets.length > 0)
  const closedAssets = groups.flatMap((g) => splitByStatus(g.assets).closed)

  return (
    <div className="flex flex-col gap-5 pb-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-[var(--ink-head)]">{t(locale, 'assets.title')}</h1>
        <Link
          href="/assets/new"
          className="pressable flex min-h-[44px] items-center gap-1 rounded-full bg-[var(--primary-btn)] px-4 py-2 text-sm font-bold text-white"
        >
          <Plus size={16} strokeWidth={2.5} />
          {t(locale, 'assets.add')}
        </Link>
      </header>

      {activeGroups.length === 0 && closedAssets.length === 0 ? (
        <p className="py-10 text-center text-sm font-semibold text-[var(--faint)]">{t(locale, 'assets.empty')}</p>
      ) : (
        <div className="flex flex-col gap-5">
          {activeGroups.map((g) => (
            <div key={g.type} className="flex flex-col gap-2">
              <span className="px-1 text-xs font-bold tracking-wide text-[var(--muted)] uppercase">
                {t(locale, `assets.type.${g.type}`)}
              </span>
              <div className="flex flex-col gap-2">
                {g.assets.map((a) => (
                  <AssetCard key={a.id} asset={a} locale={locale} />
                ))}
              </div>
            </div>
          ))}

          {closedAssets.length > 0 && <ClosedAssets assets={closedAssets} locale={locale} />}
        </div>
      )}
    </div>
  )
}

function ClosedAssets({ assets, locale }: { assets: (Asset & { key: KeyFigure })[]; locale: 'en' | 'zh' }) {
  return (
    <details className="flex flex-col gap-2">
      <summary className="cursor-pointer list-none px-1 text-xs font-bold tracking-wide text-[var(--muted)] uppercase">
        {t(locale, 'assets.closed')} · {assets.length}
      </summary>
      <div className="mt-2 flex flex-col gap-2 opacity-60">
        {assets.map((a) => (
          <AssetCard key={a.id} asset={a} locale={locale} />
        ))}
      </div>
    </details>
  )
}

function AssetCard({ asset, locale }: { asset: Asset & { key: KeyFigure }; locale: 'en' | 'zh' }) {
  const meta = assetMetaText(asset)
  return (
    <Link href={`/assets/${asset.id}`}>
      <Card className="pressable flex items-center gap-3">
        <IconTile name={TYPE_ICON[asset.type]} tint={TYPE_TINT[asset.type]} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-[var(--ink)]">{asset.name}</p>
          {meta && <p className="truncate text-xs text-[var(--muted)]">{meta}</p>}
        </div>
        <div className="flex shrink-0 flex-col items-end">
          <MoneyText cents={asset.key.amountCents} className="text-sm font-bold text-[var(--ink-head)]" />
          <span className="text-xs font-semibold text-[var(--muted)]">{t(locale, `assets.key.${asset.key.label}`)}</span>
        </div>
        <ChevronRight size={18} strokeWidth={2} className="shrink-0 text-[var(--faint)]" />
      </Card>
    </Link>
  )
}
