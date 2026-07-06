import { listExpenses, getMonthTotalCents, countExpensesNeedingTriage } from '@/lib/data/expenses'
import { listCategories } from '@/lib/data/categories'
import { listVendors } from '@/lib/data/vendors'
import { listLocations } from '@/lib/data/locations'
import { TRIAGE_ENABLED } from '@/lib/features'
import { ExpensesView } from './ExpensesView'

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string }>
}) {
  const { y, m } = await searchParams
  const now = new Date()
  const parsedYear = Number(y)
  const parsedMonth = Number(m)
  // Fall back to the current month for missing or non-numeric params.
  const year = Number.isInteger(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100 ? parsedYear : now.getFullYear()
  const month = Number.isInteger(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12 ? parsedMonth : now.getMonth() + 1

  const [rows, totalCents, categories, vendors, locations] = await Promise.all([
    listExpenses({ year, month }),
    getMonthTotalCents(year, month),
    listCategories(), listVendors(), listLocations(),
  ])
  // Triage is disabled for now; skip the count query while the banner is hidden.
  const triageCount = TRIAGE_ENABLED ? await countExpensesNeedingTriage() : 0

  const todayISO = now.toISOString().slice(0, 10)

  return (
    <ExpensesView
      rows={rows}
      totalCents={totalCents}
      year={year}
      month={month}
      todayISO={todayISO}
      triageCount={triageCount}
      categories={categories}
      vendors={vendors}
      locations={locations}
    />
  )
}
