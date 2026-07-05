'use server'
import { deleteExpense, updateExpense } from '@/lib/data/expenses'
import { parseExpenseForm } from '@/lib/data/expenses-shared'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function deleteExpenseAction(id: string): Promise<{ ok: boolean }> {
  const res = await deleteExpense(id)
  if (!res.ok) return { ok: false }
  revalidatePath('/expenses')
  revalidatePath('/')
  return { ok: true }
}

export async function updateExpenseAction(formData: FormData) {
  const id = formData.get('id')
  if (typeof id !== 'string' || !id) redirect('/expenses')
  const res = await updateExpense(id as string, parseExpenseForm(formData))
  if (!res.ok) redirect(`/expenses/edit/${id}?error=` + encodeURIComponent(res.error))
  revalidatePath('/expenses'); revalidatePath('/')
  redirect('/expenses')
}
