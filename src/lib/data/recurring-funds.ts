import { createClient } from '@/lib/supabase/server'
import { getMembership } from './household'
import { fanOutRecurring } from './recurring-funds-shared'
import type { RecurringFund, RecurringFundInput } from './recurring-funds-shared'

export { fanOutRecurring, sumForMember } from './recurring-funds-shared'
export type { RecurringFund, RecurringFundInput } from './recurring-funds-shared'

export async function listRecurringFunds(): Promise<RecurringFund[]> {
  const m = await getMembership()
  if (!m) return []
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('recurring_funds')
    .select('id, member_code, name, amount_cents, remark, sort_order')
    .eq('household_id', m.householdId)
    .order('member_code', { ascending: true })
    .order('sort_order', { ascending: true })
  if (error) { console.error('listRecurringFunds:', error.message); return [] }
  return ((data ?? []) as { id: string; member_code: 'CH' | 'JC'; name: string; amount_cents: number; remark: string | null; sort_order: number }[])
    .map((r) => ({ id: r.id, memberCode: r.member_code, name: r.name, amountCents: r.amount_cents, remark: r.remark, sortOrder: r.sort_order }))
}

export async function createRecurringFunds(input: RecurringFundInput): Promise<{ ok: boolean; error?: string }> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }
  if (!input.name.trim()) return { ok: false, error: 'invalid_name' }
  if (!Number.isInteger(input.amountCents) || input.amountCents < 0) return { ok: false, error: 'invalid_amount' }
  if (input.members.length === 0) return { ok: false, error: 'no_members' }
  const supabase = await createClient()
  const rows = fanOutRecurring(input).map((r) => ({ ...r, household_id: m.householdId }))
  const { error } = await supabase.from('recurring_funds').insert(rows)
  if (error) { console.error('createRecurringFunds:', error.message); return { ok: false, error: 'save_failed' } }
  return { ok: true }
}

export async function updateRecurringFund(
  id: string,
  patch: { name: string; amountCents: number; remark: string | null },
): Promise<{ ok: boolean; error?: string }> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }
  if (!patch.name.trim()) return { ok: false, error: 'invalid_name' }
  if (!Number.isInteger(patch.amountCents) || patch.amountCents < 0) return { ok: false, error: 'invalid_amount' }
  const supabase = await createClient()
  const { error } = await supabase
    .from('recurring_funds')
    .update({ name: patch.name, amount_cents: patch.amountCents, remark: patch.remark })
    .eq('id', id).eq('household_id', m.householdId)
  if (error) { console.error('updateRecurringFund:', error.message); return { ok: false, error: 'save_failed' } }
  return { ok: true }
}

export async function deleteRecurringFund(id: string): Promise<{ ok: boolean }> {
  const m = await getMembership()
  if (!m) return { ok: false }
  const supabase = await createClient()
  const { error } = await supabase.from('recurring_funds').delete().eq('id', id).eq('household_id', m.householdId)
  if (error) { console.error('deleteRecurringFund:', error.message); return { ok: false } }
  return { ok: true }
}
