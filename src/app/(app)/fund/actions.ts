'use server'
import { createClient } from '@/lib/supabase/server'
import { getMembership } from '@/lib/data/household'
import { revalidatePath } from 'next/cache'
import type { FundConfig } from '@/lib/data/fund'
import { deleteFundRecord } from '@/lib/data/fund'

export async function toggleContributionPaid(
  member: 'CH' | 'JC',
  periodISO: string,
): Promise<{ ok: boolean }> {
  const m = await getMembership()
  if (!m) return { ok: false }
  const supabase = await createClient()
  // Read current status for this household+member+period, then flip it.
  const { data, error } = await supabase
    .from('joint_fund_contributions')
    .select('id, status')
    .eq('household_id', m.householdId).eq('member_code', member).eq('period', periodISO)
    .single()
  if (error || !data) { console.error('toggleContributionPaid read:', error?.message); return { ok: false } }
  const next = data.status === 'paid' ? 'pending' : 'paid'
  const { error: upErr } = await supabase
    .from('joint_fund_contributions').update({ status: next })
    .eq('id', data.id).eq('household_id', m.householdId)
  if (upErr) { console.error('toggleContributionPaid update:', upErr.message); return { ok: false } }
  revalidatePath('/fund'); revalidatePath('/')
  return { ok: true }
}

export async function updateFundConfig(input: FundConfig): Promise<{ ok: boolean; error?: string }> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }
  for (const code of ['CH', 'JC'] as const) {
    const c = input[code]
    if (!Number.isInteger(c.expectedMonthlyCents) || c.expectedMonthlyCents < 0) return { ok: false, error: 'invalid_amount' }
    if (!Number.isInteger(c.carryForwardCents)) return { ok: false, error: 'invalid_amount' }
  }
  const supabase = await createClient()
  const rows = (['CH', 'JC'] as const).map((code) => ({
    household_id: m.householdId, member_code: code,
    expected_monthly_cents: input[code].expectedMonthlyCents,
    carry_forward_prev_year_cents: input[code].carryForwardCents,
  }))
  const { error } = await supabase.from('joint_fund_config')
    .upsert(rows, { onConflict: 'household_id,member_code' })
  if (error) { console.error('updateFundConfig:', error.message); return { ok: false, error: 'save_failed' } }
  revalidatePath('/fund'); revalidatePath('/')
  return { ok: true }
}

export async function deleteFundRecordAction(id: string): Promise<{ ok: boolean }> {
  const res = await deleteFundRecord(id)
  if (res.ok) { revalidatePath('/fund'); revalidatePath('/') }
  return res
}
