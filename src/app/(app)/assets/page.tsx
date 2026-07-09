import Link from 'next/link'
import { getAssetsList } from '@/lib/data/assets'
import { getMembership } from '@/lib/data/household'
import { t } from '@/i18n'
import type { Asset, KeyFigure } from '@/lib/data/assets-shared'
import { splitByStatus } from '@/lib/data/assets-shared'
import { Fab } from '@/components/ui/Fab'
import { AssetRow } from './AssetRow'

export default async function AssetsPage() {
  const [groups, membership] = await Promise.all([getAssetsList(), getMembership()])
  const locale = membership?.language ?? 'en'

  const activeGroups = groups
    .map((g) => ({ type: g.type, assets: splitByStatus(g.assets).active }))
    .filter((g) => g.assets.length > 0)
  const closedAssets = groups.flatMap((g) => splitByStatus(g.assets).closed)

  return (
    // pb-28 clears the fixed FAB so the last rows scroll past it.
    <div className="flex flex-col gap-5 pb-28">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-[var(--ink-head)]">{t(locale, 'assets.title')}</h1>
        <Link href="/assets/categories"
          className="pressable-opacity text-sm font-bold text-[var(--primary)]">
          {t(locale, 'assets.manageCategories')}
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
                  <AssetRow key={a.id} asset={a} />
                ))}
              </div>
            </div>
          ))}

          {closedAssets.length > 0 && <ClosedAssets assets={closedAssets} locale={locale} />}
        </div>
      )}

      <Fab href="/assets/new" />
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
          <AssetRow key={a.id} asset={a} />
        ))}
      </div>
    </details>
  )
}
