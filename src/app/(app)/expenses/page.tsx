import { listExpenses, getMonthTotalCents } from '@/lib/data/expenses'
import { ExpensesView } from './ExpensesView'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string }>
}) {
  const { y, m } = await searchParams
  const now = new Date()
  const year = y ? Number(y) : now.getFullYear()
  const month = m ? Number(m) : now.getMonth() + 1

  const [rows, totalCents] = await Promise.all([
    listExpenses({ year, month }),
    getMonthTotalCents(year, month),
  ])

  const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`
  const todayISO = now.toISOString().slice(0, 10)

  return (
    <ExpensesView
      rows={rows}
      totalCents={totalCents}
      year={year}
      month={month}
      monthLabel={monthLabel}
      todayISO={todayISO}
    />
  )
}
