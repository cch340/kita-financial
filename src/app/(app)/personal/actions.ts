'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getMembership } from '@/lib/data/household'

export async function addLedgerEntry(input: {
  member: 'CH' | 'JC'
  period: string
  entryType: 'income' | 'expense'
  description: string
  amountCents: number
}): Promise<{ ok: boolean; error?: string }> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }
  if (input.member !== 'CH' && input.member !== 'JC') return { ok: false, error: 'invalid_member' }
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) return { ok: false, error: 'invalid_amount' }

  const supabase = await createClient()
  const { error } = await supabase.from('ledger_entries').insert({
    household_id: m.householdId,
    owner_member_code: input.member,
    period: input.period,
    entry_type: input.entryType,
    description: input.description.trim(),
    amount_cents: input.amountCents,
  })
  if (error) {
    console.error('addLedgerEntry:', error.message)
    return { ok: false, error: 'save_failed' }
  }
  revalidatePath('/personal')
  revalidatePath('/')
  return { ok: true }
}
