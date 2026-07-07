'use server'
import { revalidatePath } from 'next/cache'
import { deleteFundRecord } from '@/lib/data/fund'

export async function deleteFundRecordAction(id: string): Promise<{ ok: boolean }> {
  const res = await deleteFundRecord(id)
  if (res.ok) { revalidatePath('/fund'); revalidatePath('/') }
  return res
}
