import { redirect } from 'next/navigation'
import { listExpensesNeedingTriage } from '@/lib/data/expenses'
import { listCategories } from '@/lib/data/categories'
import { TRIAGE_ENABLED } from '@/lib/features'
import { TriageView } from './TriageView'

export default async function TriagePage() {
  // Triage is disabled for now; keep the route but send visitors back.
  if (!TRIAGE_ENABLED) redirect('/expenses')
  const [items, categories] = await Promise.all([listExpensesNeedingTriage(), listCategories()])
  return <TriageView items={items} categories={categories} />
}
