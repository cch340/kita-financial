import { notFound } from 'next/navigation'
import { getExpense } from '@/lib/data/expenses'
import { EditExpenseForm } from './EditExpenseForm'

export default async function EditExpensePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams
  const row = await getExpense(id)
  if (!row) notFound()
  return <EditExpenseForm row={row} error={error} />
}
