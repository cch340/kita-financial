import { AddExpenseForm } from './AddExpenseForm'

export default async function AddExpensePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  return <AddExpenseForm error={error} />
}
