import { listExpensesNeedingTriage } from '@/lib/data/expenses'
import { TriageView } from './TriageView'

export default async function TriagePage() {
  const items = await listExpensesNeedingTriage()
  return <TriageView items={items} />
}
