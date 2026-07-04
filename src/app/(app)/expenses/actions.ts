'use server'
import { deleteExpense } from '@/lib/data/expenses'
import { revalidatePath } from 'next/cache'

export async function deleteExpenseAction(id: string) {
  await deleteExpense(id)
  revalidatePath('/expenses')
  revalidatePath('/')
}
