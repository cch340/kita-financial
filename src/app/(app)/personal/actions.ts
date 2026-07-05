'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getMembership } from '@/lib/data/household'
import { validateLedgerInput } from '@/lib/data/personal-shared'

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

export async function updateLedgerEntry(input: {
  id: string
  entryType: 'income' | 'expense'
  description: string
  amountCents: number
}): Promise<{ ok: boolean; error?: string }> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }
  const valid = validateLedgerInput(input)
  if (!valid.ok) return { ok: false, error: valid.error }
  const supabase = await createClient()
  const { error } = await supabase.from('ledger_entries')
    .update({ entry_type: input.entryType, description: input.description.trim(), amount_cents: input.amountCents })
    .eq('id', input.id).eq('household_id', m.householdId)
  if (error) { console.error('updateLedgerEntry:', error.message); return { ok: false, error: 'save_failed' } }
  revalidatePath('/personal'); revalidatePath('/')
  return { ok: true }
}

export async function deleteLedgerEntry(id: string): Promise<{ ok: boolean }> {
  const m = await getMembership()
  if (!m) return { ok: false }
  const supabase = await createClient()
  const { error } = await supabase.from('ledger_entries').delete().eq('id', id).eq('household_id', m.householdId)
  if (error) { console.error('deleteLedgerEntry:', error.message); return { ok: false } }
  revalidatePath('/personal'); revalidatePath('/')
  return { ok: true }
}
