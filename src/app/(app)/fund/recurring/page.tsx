import { listRecurringFunds } from '@/lib/data/recurring-funds'
import { getMembership } from '@/lib/data/household'
import { RecurringFundsView } from './RecurringFundsView'

export default async function RecurringFundsPage() {
  const [funds, membership] = await Promise.all([listRecurringFunds(), getMembership()])
  const locale = membership?.language ?? 'en'
  return <RecurringFundsView funds={funds} locale={locale} />
}
