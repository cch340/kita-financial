import { getBudgetCategoriesRaw, getCommitmentsRaw } from '@/lib/data/budget'
import { BudgetManager } from './BudgetManager'

export default async function BudgetManagePage() {
  const [categories, commitments] = await Promise.all([getBudgetCategoriesRaw(), getCommitmentsRaw()])
  return <BudgetManager categories={categories} commitments={commitments} />
}
