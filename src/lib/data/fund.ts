import { createClient } from '@/lib/supabase/server'
import { getMembership } from './household'
import { monthRange } from './summary'
import type { Member } from './types'
import { buildFundMonths, collapseLeadingPaid } from './fund-shared'
import type { MemberCell, FundMonth, FundOverview, ContribRow, FundRecord } from './fund-shared'

// Re-exported for backward compatibility — prefer importing from './fund-shared'
// in client components (this module pulls in supabase/server via getFundOverview).
export { buildFundMonths, collapseLeadingPaid }
export type { MemberCell, FundMonth, FundOverview, FundRecord }

export async function getFundOverview(year: number): Promise<FundOverview> {
  const empty: FundOverview = {
    year, expectedEachCents: { CH: 0, JC: 0 }, carryForwardCents: 0,
    yearContributedCents: 0, yearExpectedCents: 0, months: buildFundMonths([], year),
  }
  const m = await getMembership()
  if (!m) return empty
  const supabase = await createClient()
  const { startISO } = monthRange(year, 1)
  const { startISO: nextYearStart } = monthRange(year + 1, 1)

  const [contribRes, configRes] = await Promise.all([
    supabase.from('joint_fund_contributions')
      .select('member_code, period, amount_cents, status')
      .eq('household_id', m.householdId).gte('period', startISO).lt('period', nextYearStart),
    supabase.from('joint_fund_config')
      .select('member_code, expected_monthly_cents, carry_forward_prev_year_cents')
      .eq('household_id', m.householdId),
  ])
  if (contribRes.error) console.error('getFundOverview contributions:', contribRes.error.message)
  if (configRes.error) console.error('getFundOverview config:', configRes.error.message)

  const rows = (contribRes.data ?? []) as ContribRow[]
  const config = (configRes.data ?? []) as { member_code: Member; expected_monthly_cents: number; carry_forward_prev_year_cents: number }[]

  const expectedEachCents = { CH: 0, JC: 0 }
  let carryForwardCents = 0
  for (const c of config) {
    expectedEachCents[c.member_code] = c.expected_monthly_cents
    carryForwardCents += c.carry_forward_prev_year_cents
  }
  const yearContributedCents = rows.filter((r) => r.status === 'paid').reduce((a, r) => a + r.amount_cents, 0)
  const yearExpectedCents = (expectedEachCents.CH + expectedEachCents.JC) * 12 + carryForwardCents

  return { year, expectedEachCents, carryForwardCents, yearContributedCents, yearExpectedCents, months: buildFundMonths(rows, year) }
}

type FundRecordInput = { memberCode: Member; periodISO: string; amountCents: number; notes: string | null }

function validateFundRecord(input: FundRecordInput): string | null {
  if (input.memberCode !== 'CH' && input.memberCode !== 'JC') return 'invalid_member'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.periodISO)) return 'invalid_period'
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) return 'invalid_amount'
  return null
}

export async function listFundRecords(): Promise<FundRecord[]> {
  const m = await getMembership()
  if (!m) return []
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('joint_fund_contributions')
    .select('id, member_code, period, amount_cents, notes')
    .eq('household_id', m.householdId)
    .order('period', { ascending: false })
  if (error) { console.error('listFundRecords:', error.message); return [] }
  return ((data ?? []) as { id: string; member_code: Member; period: string; amount_cents: number; notes: string | null }[])
    .map((r) => ({ id: r.id, memberCode: r.member_code, periodISO: r.period, amountCents: r.amount_cents, notes: r.notes }))
}

export async function createFundRecord(input: FundRecordInput): Promise<{ ok: boolean; error?: string }> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }
  const invalid = validateFundRecord(input)
  if (invalid) return { ok: false, error: invalid }
  const supabase = await createClient()
  const { error } = await supabase.from('joint_fund_contributions').insert({
    household_id: m.householdId, member_code: input.memberCode, period: input.periodISO,
    amount_cents: input.amountCents, status: 'paid', notes: input.notes,
  })
  if (error) { console.error('createFundRecord:', error.message); return { ok: false, error: 'save_failed' } }
  return { ok: true }
}

export async function updateFundRecord(id: string, patch: FundRecordInput): Promise<{ ok: boolean; error?: string }> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }
  const invalid = validateFundRecord(patch)
  if (invalid) return { ok: false, error: invalid }
  const supabase = await createClient()
  const { error } = await supabase.from('joint_fund_contributions')
    .update({ member_code: patch.memberCode, period: patch.periodISO, amount_cents: patch.amountCents, notes: patch.notes })
    .eq('id', id).eq('household_id', m.householdId)
  if (error) { console.error('updateFundRecord:', error.message); return { ok: false, error: 'save_failed' } }
  return { ok: true }
}

export async function deleteFundRecord(id: string): Promise<{ ok: boolean }> {
  const m = await getMembership()
  if (!m) return { ok: false }
  const supabase = await createClient()
  const { error } = await supabase.from('joint_fund_contributions').delete().eq('id', id).eq('household_id', m.householdId)
  if (error) { console.error('deleteFundRecord:', error.message); return { ok: false } }
  return { ok: true }
}
