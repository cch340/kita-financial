// Pure, server/client-safe fund helpers and types — no supabase import here.
// Kept separate from fund.ts so client components can import these without
// pulling in `next/headers` (via createClient) through getFundOverview.
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

export type ContribRow = { member_code: Member; period: string; amount_cents: number; status: 'paid' | 'pending' }

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
