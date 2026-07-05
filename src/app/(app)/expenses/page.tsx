import { listExpenses, getMonthTotalCents, countExpensesNeedingTriage } from '@/lib/data/expenses'
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

  const [rows, totalCents, triageCount] = await Promise.all([
    listExpenses({ year, month }),
    getMonthTotalCents(year, month),
    countExpensesNeedingTriage(),
  ])

  const todayISO = now.toISOString().slice(0, 10)

  return (
    <ExpensesView
      rows={rows}
      totalCents={totalCents}
      year={year}
      month={month}
      todayISO={todayISO}
      triageCount={triageCount}
    />
  )
}
