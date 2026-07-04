import { createClient } from '@/lib/supabase/server'
import { getMembership } from './household'
import { monthRange } from './summary'
import type { Member } from './types'

export type MemberCell = { amountCents: number; status: 'paid' | 'pending' } | null
export type FundMonth = { month: number; periodISO: string; ch: MemberCell; jc: MemberCell }
export type FundOverview = {
  year: number
  expectedEachCents: { CH: number; JC: number }
  carryForwardCents: number
  yearContributedCents: number
  yearExpectedCents: number
  months: FundMonth[]
}

type ContribRow = { member_code: Member; period: string; amount_cents: number; status: 'paid' | 'pending' }

const pad = (n: number) => String(n).padStart(2, '0')

export function buildFundMonths(rows: ContribRow[], year: number): FundMonth[] {
  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1
    const periodISO = `${year}-${pad(month)}-01`
    const cell = (m: Member): MemberCell => {
      const row = rows.find((x) => x.member_code === m && x.period === periodISO)
      return row ? { amountCents: row.amount_cents, status: row.status } : null
    }
    return { month, periodISO, ch: cell('CH'), jc: cell('JC') }
  })
}

export function collapseLeadingPaid(months: FundMonth[]) {
  let count = 0
  let totalCents = 0
  for (const m of months) {
    const bothPaid = m.ch?.status === 'paid' && m.jc?.status === 'paid'
    if (!bothPaid) break
    count++
    totalCents += (m.ch?.amountCents ?? 0) + (m.jc?.amountCents ?? 0)
  }
  if (count === 0) return { summary: null as null, rest: months }
  return { summary: { throughMonth: count, count, totalCents }, rest: months.slice(count) }
}

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
