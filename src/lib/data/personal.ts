import { createClient } from '@/lib/supabase/server'
import { getMembership } from './household'
import { monthRange } from './summary'
import { sumByType, balanceCents, type LedgerEntry } from './personal-shared'

// Re-exported for convenience — prefer importing from './personal-shared' in client
// components (this module pulls in supabase/server via getPersonalLedger/getPersonalBalances).
export { sumByType, balanceCents }
export type { LedgerEntry }

const COLS = 'id, owner_member_code, period, entry_type, description, amount_cents, remark'

function mapEntry(r: Record<string, unknown>): LedgerEntry {
  return {
    id: r.id as string,
    ownerMemberCode: r.owner_member_code as 'CH' | 'JC',
    period: r.period as string,
    entryType: r.entry_type as 'income' | 'expense',
    description: r.description as string,
    amountCents: r.amount_cents as number,
    remark: (r.remark as string | null) ?? null,
  }
}

export type PersonalLedger = {
  income: LedgerEntry[]
  expenses: LedgerEntry[]
  incomeCents: number
  expensesCents: number
  balanceCents: number
  availableMonths: string[]
}

const emptyLedger: PersonalLedger = {
  income: [],
  expenses: [],
  incomeCents: 0,
  expensesCents: 0,
  balanceCents: 0,
  availableMonths: [],
}

export async function getPersonalLedger(member: 'CH' | 'JC', year: number, month: number): Promise<PersonalLedger> {
  const m = await getMembership()
  if (!m) return emptyLedger
  const supabase = await createClient()
  const { startISO } = monthRange(year, month)

  const [entriesRes, monthsRes] = await Promise.all([
    supabase
      .from('ledger_entries')
      .select(COLS)
      .eq('household_id', m.householdId)
      .eq('owner_member_code', member)
      .eq('period', startISO),
    supabase
      .from('ledger_entries')
      .select('period')
      .eq('household_id', m.householdId)
      .eq('owner_member_code', member)
      .order('period', { ascending: false }),
  ])
  if (entriesRes.error) console.error('getPersonalLedger entries:', entriesRes.error.message)
  if (monthsRes.error) console.error('getPersonalLedger months:', monthsRes.error.message)

  const entries = (entriesRes.data ?? []).map(mapEntry)
  const income = entries.filter((e) => e.entryType === 'income')
  const expenses = entries.filter((e) => e.entryType === 'expense')

  const availableMonths = Array.from(new Set((monthsRes.data ?? []).map((r) => r.period as string)))

  return {
    income,
    expenses,
    incomeCents: sumByType(entries, 'income'),
    expensesCents: sumByType(entries, 'expense'),
    balanceCents: balanceCents(entries),
    availableMonths,
  }
}

export async function getPersonalBalances(year: number, month: number): Promise<{ CH: number; JC: number }> {
  const m = await getMembership()
  if (!m) return { CH: 0, JC: 0 }
  const supabase = await createClient()
  const { startISO } = monthRange(year, month)

  const { data, error } = await supabase
    .from('ledger_entries')
    .select(COLS)
    .eq('household_id', m.householdId)
    .eq('period', startISO)
  if (error) { console.error('getPersonalBalances:', error.message); return { CH: 0, JC: 0 } }

  const entries = (data ?? []).map(mapEntry)
  const forMember = (code: 'CH' | 'JC') => entries.filter((e) => e.ownerMemberCode === code)
  return { CH: balanceCents(forMember('CH')), JC: balanceCents(forMember('JC')) }
}
