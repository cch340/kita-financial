import { listCategories } from '@/lib/data/categories'
import { listVendors } from '@/lib/data/vendors'
import { listLocations } from '@/lib/data/locations'
import { AddExpenseForm } from './AddExpenseForm'

export default async function AddExpensePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const [categories, vendors, locations] = await Promise.all([
    listCategories(), listVendors(), listLocations(),
  ])
  return <AddExpenseForm error={error} categories={categories} vendors={vendors} locations={locations} />
}
