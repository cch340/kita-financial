import { createClient } from '@/lib/supabase/server'
import { getMembership } from './household'
import { monthRange } from './summary'
import { getFundOverview } from './fund'
import type { FundOverview } from './fund-shared'
import { buildCategoryMonthMatrix, personalBalanceTrend, type CategoryMonthMatrix } from './report-shared'
import { EXPENSE_SELECT, mapExpenseRow } from './expenses'
import type { ExpenseRow, Member } from './types'
import type { LedgerEntry } from './personal-shared'

// Re-export the pure helpers for convenience (client code should still prefer ./report-shared).
export { buildCategoryMonthMatrix, personalBalanceTrend }
export type { CategoryMonthMatrix }

const LEDGER_COLS = 'id, owner_member_code, period, entry_type, description, amount_cents, remark'

function mapLedger(r: Record<string, unknown>): LedgerEntry {
  return {
    id: r.id as string,
    ownerMemberCode: r.owner_member_code as Member,
    period: r.period as string,
    entryType: r.entry_type as 'income' | 'expense',
    description: r.description as string,
    amountCents: r.amount_cents as number,
    remark: (r.remark as string | null) ?? null,
  }
}

export async function getExpensesForYear(year: number): Promise<ExpenseRow[]> {
  const m = await getMembership()
  if (!m) return []
  const supabase = await createClient()
  const { startISO } = monthRange(year, 1)
  const { startISO: nextYearStart } = monthRange(year + 1, 1)
  const { data, error } = await supabase
    .from('expenses').select(EXPENSE_SELECT)
    .eq('household_id', m.householdId)
    .gte('date', startISO).lt('date', nextYearStart)
    .order('date', { ascending: false })
  if (error) { console.error('getExpensesForYear failed:', error.message); return [] }
  return (data ?? []).map((r) => mapExpenseRow(r as never))
}

export async function getLedgerForYear(member: Member, year: number): Promise<LedgerEntry[]> {
  const m = await getMembership()
  if (!m) return []
  const supabase = await createClient()
  const { startISO } = monthRange(year, 1)
  const { startISO: nextYearStart } = monthRange(year + 1, 1)
  const { data, error } = await supabase
    .from('ledger_entries').select(LEDGER_COLS)
    .eq('household_id', m.householdId)
    .eq('owner_member_code', member)
    .gte('period', startISO).lt('period', nextYearStart)
    .order('period', { ascending: true })
  if (error) { console.error('getLedgerForYear failed:', error.message); return [] }
  return (data ?? []).map(mapLedger)
}

export async function getReportYears(): Promise<number[]> {
  const currentYear = new Date().getFullYear()
  const m = await getMembership()
  if (!m) return [currentYear]
  const supabase = await createClient()
  const [expRes, ledRes] = await Promise.all([
    supabase.from('expenses').select('date').eq('household_id', m.householdId),
    supabase.from('ledger_entries').select('period').eq('household_id', m.householdId),
  ])
  if (expRes.error) console.error('getReportYears expenses:', expRes.error.message)
  if (ledRes.error) console.error('getReportYears ledger:', ledRes.error.message)
  const years = new Set<number>([currentYear])
  for (const r of (expRes.data ?? []) as { date: string }[]) years.add(Number(r.date.slice(0, 4)))
  for (const r of (ledRes.data ?? []) as { period: string }[]) years.add(Number(r.period.slice(0, 4)))
  return [...years].filter((y) => Number.isInteger(y)).sort((a, b) => b - a)
}

export type YearReport = {
  year: number
  matrix: CategoryMonthMatrix
  fund: FundOverview
  personalTrend: { CH: number[]; JC: number[] }
  availableYears: number[]
}

export async function getYearReport(year: number): Promise<YearReport> {
  const [expenses, chLedger, jcLedger, fund, availableYears] = await Promise.all([
    getExpensesForYear(year),
    getLedgerForYear('CH', year),
    getLedgerForYear('JC', year),
    getFundOverview(year),
    getReportYears(),
  ])
  return {
    year,
    matrix: buildCategoryMonthMatrix(expenses, year),
    fund,
    personalTrend: {
      CH: personalBalanceTrend(chLedger, year),
      JC: personalBalanceTrend(jcLedger, year),
    },
    availableYears,
  }
}
