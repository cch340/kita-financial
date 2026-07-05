import { createClient } from '@/lib/supabase/server'
import { getMembership } from './household'
import { monthRange } from './summary'
import type { ExpenseRow } from './types'
import { validateExpenseInput, type ExpenseInput } from './expenses-shared'
import { validateTriageInput, type TriageInput } from './triage-shared'

// Re-exported for convenience; client components should import from the -shared modules.
export { validateExpenseInput, validateTriageInput }
export type { ExpenseInput, TriageInput }

const COLS = 'id, date, vendor, location, details, category, amount_cents, paid_by'

export async function listExpenses(opts?: { year?: number; month?: number }): Promise<ExpenseRow[]> {
  const m = await getMembership()
  if (!m) return []
  const supabase = await createClient()
  let q = supabase.from('expenses').select(COLS).eq('household_id', m.householdId).order('date', { ascending: false })
  if (opts?.year && opts?.month) {
    const { startISO, endISO } = monthRange(opts.year, opts.month)
    q = q.gte('date', startISO).lt('date', endISO)
  }
  const { data, error } = await q
  if (error) { console.error('listExpenses failed:', error.message); return [] }
  return (data ?? []) as ExpenseRow[]
}

export async function getMonthTotalCents(year: number, month: number): Promise<number> {
  const rows = await listExpenses({ year, month })
  return rows.reduce((a, r) => a + r.amount_cents, 0)
}

export async function getExpense(id: string): Promise<ExpenseRow | null> {
  const m = await getMembership()
  if (!m) return null
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('expenses').select(COLS).eq('id', id).eq('household_id', m.householdId).single()
  if (error || !data) {
    if (error && error.code !== 'PGRST116') console.error('getExpense failed:', error.message)
    return null
  }
  return data as ExpenseRow
}

export async function addExpense(input: ExpenseInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }
  const valid = validateExpenseInput(input)
  if (!valid.ok) return valid
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase.from('expenses').insert({
    household_id: m.householdId,
    date: input.dateISO,
    vendor: input.vendor,
    location: input.location,
    details: input.note,
    category: input.category,
    amount_cents: input.amountCents,
    paid_by: input.paidBy,
    created_by: user?.id ?? null,
  })
  if (error) { console.error('addExpense failed:', error.message); return { ok: false, error: 'save_failed' } }
  return { ok: true }
}

export async function updateExpense(id: string, input: ExpenseInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }
  const valid = validateExpenseInput(input)
  if (!valid.ok) return valid
  const supabase = await createClient()
  const { error } = await supabase.from('expenses').update({
    date: input.dateISO,
    vendor: input.vendor,
    location: input.location,
    details: input.note,
    category: input.category,
    amount_cents: input.amountCents,
    paid_by: input.paidBy,
  }).eq('id', id).eq('household_id', m.householdId)
  if (error) { console.error('updateExpense failed:', error.message); return { ok: false, error: 'save_failed' } }
  return { ok: true }
}

export async function deleteExpense(id: string): Promise<{ ok: boolean; error?: string }> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'Not authenticated' }
  const supabase = await createClient()
  const { error } = await supabase.from('expenses').delete().eq('id', id).eq('household_id', m.householdId)
  if (error) { console.error('deleteExpense failed:', error.message); return { ok: false, error: error.message } }
  return { ok: true }
}

export async function listExpensesNeedingTriage(): Promise<ExpenseRow[]> {
  const m = await getMembership()
  if (!m) return []
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('expenses')
    .select(COLS)
    .eq('household_id', m.householdId)
    .or('category.is.null,paid_by.is.null')
    .order('date', { ascending: true })
  if (error) { console.error('listExpensesNeedingTriage failed:', error.message); return [] }
  return (data ?? []) as ExpenseRow[]
}

export async function countExpensesNeedingTriage(): Promise<number> {
  const m = await getMembership()
  if (!m) return 0
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('expenses')
    .select('id', { count: 'exact', head: true })
    .eq('household_id', m.householdId)
    .or('category.is.null,paid_by.is.null')
  if (error) { console.error('countExpensesNeedingTriage failed:', error.message); return 0 }
  return count ?? 0
}

export async function setExpenseCategoryPaidBy(
  id: string,
  input: TriageInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }
  const valid = validateTriageInput(input)
  if (!valid.ok) return valid
  const supabase = await createClient()
  const { error } = await supabase
    .from('expenses')
    .update({ category: input.category, paid_by: input.paidBy })
    .eq('id', id)
    .eq('household_id', m.householdId)
  if (error) { console.error('setExpenseCategoryPaidBy failed:', error.message); return { ok: false, error: 'save_failed' } }
  return { ok: true }
}
