import { createClient } from '@/lib/supabase/server'
import { getMembership } from './household'
import { monthRange } from './summary'
import type { Member } from './types'
import { buildFundMonths, collapseLeadingPaid } from './fund-shared'
import type { MemberCell, FundMonth, FundOverview, ContribRow } from './fund-shared'

// Re-exported for backward compatibility — prefer importing from './fund-shared'
// in client components (this module pulls in supabase/server via getFundOverview).
export { buildFundMonths, collapseLeadingPaid }
export type { MemberCell, FundMonth, FundOverview }

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

export type FundConfig = {
  CH: { expectedMonthlyCents: number; carryForwardCents: number }
  JC: { expectedMonthlyCents: number; carryForwardCents: number }
}

export async function getFundConfig(): Promise<FundConfig> {
  const empty: FundConfig = { CH: { expectedMonthlyCents: 0, carryForwardCents: 0 }, JC: { expectedMonthlyCents: 0, carryForwardCents: 0 } }
  const m = await getMembership()
  if (!m) return empty
  const supabase = await createClient()
  const { data, error } = await supabase.from('joint_fund_config')
    .select('member_code, expected_monthly_cents, carry_forward_prev_year_cents')
    .eq('household_id', m.householdId)
  if (error) { console.error('getFundConfig:', error.message); return empty }
  const out: FundConfig = { CH: { expectedMonthlyCents: 0, carryForwardCents: 0 }, JC: { expectedMonthlyCents: 0, carryForwardCents: 0 } }
  for (const r of (data ?? []) as { member_code: 'CH' | 'JC'; expected_monthly_cents: number; carry_forward_prev_year_cents: number }[]) {
    out[r.member_code] = { expectedMonthlyCents: r.expected_monthly_cents, carryForwardCents: r.carry_forward_prev_year_cents }
  }
  return out
}
