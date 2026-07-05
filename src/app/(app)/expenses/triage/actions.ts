'use server'
import { setExpenseCategoryPaidBy } from '@/lib/data/expenses'
import { revalidatePath } from 'next/cache'

export async function setExpenseTriageAction(
  id: string,
  category: string,
  paidBy: 'CH' | 'JC',
): Promise<{ ok: boolean; error?: string }> {
  const res = await setExpenseCategoryPaidBy(id, { category, paidBy })
  if (!res.ok) return { ok: false, error: res.error }
  revalidatePath('/expenses')
  revalidatePath('/')
  return { ok: true }
}
