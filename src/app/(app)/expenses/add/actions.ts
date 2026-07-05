'use server'
import { addExpense } from '@/lib/data/expenses'
import { parseExpenseForm } from '@/lib/data/expenses-shared'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function addExpenseAction(formData: FormData) {
  const res = await addExpense(parseExpenseForm(formData))
  if (!res.ok) redirect('/expenses/add?error=' + encodeURIComponent(res.error))
  revalidatePath('/expenses'); revalidatePath('/')
  redirect('/expenses')
}
