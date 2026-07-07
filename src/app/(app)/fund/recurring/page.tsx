import { listRecurringFunds } from '@/lib/data/recurring-funds'
import { RecurringFundsView } from './RecurringFundsView'

export default async function RecurringFundsPage() {
  const funds = await listRecurringFunds()
  return <RecurringFundsView funds={funds} />
}
