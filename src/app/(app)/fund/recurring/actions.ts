'use server'
import { createRecurringFunds, updateRecurringFund, deleteRecurringFund } from '@/lib/data/recurring-funds'
import type { Member } from '@/lib/data/types'
import { revalidatePath } from 'next/cache'

export async function createRecurringAction(input: {
  name: string; amountCents: number; remark: string | null; members: Member[]
}): Promise<{ ok: boolean; error?: string }> {
  const res = await createRecurringFunds(input)
  if (res.ok) revalidatePath('/fund/recurring')
  return res
}

export async function updateRecurringAction(
  id: string, patch: { name: string; amountCents: number; remark: string | null },
): Promise<{ ok: boolean; error?: string }> {
  const res = await updateRecurringFund(id, patch)
  if (res.ok) revalidatePath('/fund/recurring')
  return res
}

export async function deleteRecurringAction(id: string): Promise<{ ok: boolean }> {
  const res = await deleteRecurringFund(id)
  if (res.ok) revalidatePath('/fund/recurring')
  return res
}
