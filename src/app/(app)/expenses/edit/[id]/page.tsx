import { notFound } from 'next/navigation'
import { getExpense } from '@/lib/data/expenses'
import { listCategories } from '@/lib/data/categories'
import { listVendors } from '@/lib/data/vendors'
import { listLocations } from '@/lib/data/locations'
import { EditExpenseForm } from './EditExpenseForm'

export default async function EditExpensePage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams
  const [row, categories, vendors, locations] = await Promise.all([
    getExpense(id), listCategories(), listVendors(), listLocations(),
  ])
  if (!row) notFound()
  return <EditExpenseForm row={row} error={error} categories={categories} vendors={vendors} locations={locations} />
}
