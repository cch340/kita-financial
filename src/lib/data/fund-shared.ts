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

// === Fund records (ledger) — pure filtering + totals ===
export type FundRecord = {
  id: string
  memberCode: Member
  periodISO: string // 'YYYY-MM-01'
  amountCents: number
  notes: string | null
}
export type FundFilters = { member: Member | 'all'; month: number | 'all'; year: number }

export function periodISOForMonth(year: number, month: number): string {
  return `${year}-${pad(month)}-01`
}
export function yearOf(periodISO: string): number {
  return Number(periodISO.slice(0, 4))
}
export function monthOf(periodISO: string): number {
  return Number(periodISO.slice(5, 7))
}

/** Filter by member/month/year, returning newest-first. */
export function filterRecords(records: FundRecord[], f: FundFilters): FundRecord[] {
  return records
    .filter((r) => yearOf(r.periodISO) === f.year)
    .filter((r) => (f.member === 'all' ? true : r.memberCode === f.member))
    .filter((r) => (f.month === 'all' ? true : monthOf(r.periodISO) === f.month))
    .slice()
    .sort((a, b) => (a.periodISO < b.periodISO ? 1 : a.periodISO > b.periodISO ? -1 : 0))
}

/** Sum of records matching the active filters. */
export function filteredTotal(records: FundRecord[], f: FundFilters): number {
  return filterRecords(records, f).reduce((a, r) => a + r.amountCents, 0)
}

/** Sum of every record in the given year, independent of member/month filters. */
export function totalContributedThisYear(records: FundRecord[], year: number): number {
  return records.filter((r) => yearOf(r.periodISO) === year).reduce((a, r) => a + r.amountCents, 0)
}
