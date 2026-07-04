'use server'
import { createClient } from '@/lib/supabase/server'
import { getMembership } from '@/lib/data/household'
import { revalidatePath } from 'next/cache'

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
