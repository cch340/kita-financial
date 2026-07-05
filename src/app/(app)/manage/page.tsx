import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getMembership } from '@/lib/data/household'
import { listCategories } from '@/lib/data/categories'
import { listVendors } from '@/lib/data/vendors'
import { listLocations } from '@/lib/data/locations'
import { t } from '@/i18n'
import { ManageSection } from './ManageSection'

export default async function ManagePage() {
  const m = await getMembership()
  const locale = m?.language ?? 'en'
  const [categories, vendors, locations] = await Promise.all([
    listCategories(), listVendors(), listLocations(),
  ])
  return (
    <div className="flex flex-col gap-6 pb-6">
      <header className="flex items-center gap-1">
        <Link href="/more" aria-label={t(locale, 'common.back')}
          className="pressable-opacity -ml-2 grid h-11 w-11 place-items-center text-[var(--muted)]">
          <ChevronLeft size={24} />
        </Link>
        <h1 className="text-2xl font-extrabold text-[var(--ink-head)]">{t(locale, 'manage.title')}</h1>
      </header>
      <ManageSection kind="category" title={t(locale, 'manage.categories')} items={categories} />
      <ManageSection kind="vendor" title={t(locale, 'manage.vendors')} items={vendors} />
      <ManageSection kind="location" title={t(locale, 'manage.locations')} items={locations} />
    </div>
  )
}
