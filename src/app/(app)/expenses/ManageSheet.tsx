'use client'
import { useT } from '@/i18n/LocaleProvider'
import type { CatalogItem } from '@/lib/data/catalog-shared'
import { ManageSection } from '../manage/ManageSection'

/** Bottom sheet hosting the catalog manager (categories / vendors / locations).
 *  ManageSection already calls router.refresh() after each mutation, which
 *  re-runs the Expenses server page and refreshes both catalogs and rows. */
export function ManageSheet({
  categories,
  vendors,
  locations,
  onClose,
}: {
  categories: CatalogItem[]
  vendors: CatalogItem[]
  locations: CatalogItem[]
  onClose: () => void
}) {
  const t = useT()
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/30" onClick={onClose}>
      <div
        className="mx-auto w-full max-w-[430px] rounded-t-2xl bg-[var(--paper)] p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-[var(--ink-head)]">{t('manage.title')}</h2>
          <button type="button" onClick={onClose} className="pressable-opacity text-sm font-bold text-[var(--primary)]">
            {t('common.close')}
          </button>
        </div>
        <div className="flex max-h-[70vh] flex-col gap-5 overflow-y-auto">
          <ManageSection kind="category" title={t('manage.categories')} items={categories} />
          <ManageSection kind="vendor" title={t('manage.vendors')} items={vendors} />
          <ManageSection kind="location" title={t('manage.locations')} items={locations} />
        </div>
      </div>
    </div>
  )
}
