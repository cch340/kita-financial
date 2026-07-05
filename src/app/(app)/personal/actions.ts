'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getMembership } from '@/lib/data/household'
import { validateLedgerInput, pickCopySourceMonth } from '@/lib/data/personal-shared'

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

export async function copyLastMonth(input: {
  member: 'CH' | 'JC'
  targetPeriod: string
}): Promise<{ ok: boolean; error?: string }> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }
  if (input.member !== 'CH' && input.member !== 'JC') return { ok: false, error: 'invalid_member' }
  const supabase = await createClient()

  // Idempotency guard: re-check the target month is still empty inside the action,
  // so a double-tap (or a race) cannot duplicate the copy.
  const { data: existing, error: existErr } = await supabase
    .from('ledger_entries')
    .select('id')
    .eq('household_id', m.householdId)
    .eq('owner_member_code', input.member)
    .eq('period', input.targetPeriod)
    .limit(1)
  if (existErr) { console.error('copyLastMonth exist:', existErr.message); return { ok: false, error: 'save_failed' } }
  if ((existing ?? []).length > 0) return { ok: false, error: 'not_empty' }

  // Find the source month: the most recent month with data strictly before the target.
  const { data: periodRows, error: periodsErr } = await supabase
    .from('ledger_entries')
    .select('period')
    .eq('household_id', m.householdId)
    .eq('owner_member_code', input.member)
  if (periodsErr) { console.error('copyLastMonth periods:', periodsErr.message); return { ok: false, error: 'save_failed' } }
  const availableMonths = Array.from(new Set((periodRows ?? []).map((r) => r.period as string)))
  const sourcePeriod = pickCopySourceMonth(availableMonths, input.targetPeriod)
  if (!sourcePeriod) return { ok: false, error: 'nothing_to_copy' }

  // Read the source month's entries (all types — income lines like salary recur too).
  const { data: sourceRows, error: sourceErr } = await supabase
    .from('ledger_entries')
    .select('entry_type, description, amount_cents, remark')
    .eq('household_id', m.householdId)
    .eq('owner_member_code', input.member)
    .eq('period', sourcePeriod)
  if (sourceErr) { console.error('copyLastMonth source:', sourceErr.message); return { ok: false, error: 'save_failed' } }
  const rows = sourceRows ?? []
  if (rows.length === 0) return { ok: false, error: 'nothing_to_copy' }

  const clones = rows.map((r) => ({
    household_id: m.householdId,
    owner_member_code: input.member,
    period: input.targetPeriod,
    entry_type: r.entry_type as 'income' | 'expense',
    description: r.description as string,
    amount_cents: r.amount_cents as number,
    remark: (r.remark as string | null) ?? null,
  }))
  const { error: insErr } = await supabase.from('ledger_entries').insert(clones)
  if (insErr) { console.error('copyLastMonth insert:', insErr.message); return { ok: false, error: 'save_failed' } }

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
