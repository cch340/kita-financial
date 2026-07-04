'use server'
import { deleteExpense } from '@/lib/data/expenses'
import { revalidatePath } from 'next/cache'

export async function deleteExpenseAction(id: string): Promise<{ ok: boolean }> {
  const res = await deleteExpense(id)
  if (!res.ok) return { ok: false }
  revalidatePath('/expenses')
  revalidatePath('/')
  return { ok: true }
}
