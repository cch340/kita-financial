import { listExpensesNeedingTriage } from '@/lib/data/expenses'
import { listCategories } from '@/lib/data/categories'
import { TriageView } from './TriageView'

export default async function TriagePage() {
  const [items, categories] = await Promise.all([listExpensesNeedingTriage(), listCategories()])
  return <TriageView items={items} categories={categories} />
}
