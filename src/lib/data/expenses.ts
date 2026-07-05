import { createClient } from '@/lib/supabase/server'
import { getMembership } from './household'
import { monthRange } from './summary'
import type { ExpenseRow, Member } from './types'
import { validateExpenseInput, type ExpenseInput } from './expenses-shared'
import { validateTriageInput, type TriageInput } from './triage-shared'

// Re-exported for convenience; client components should import from the -shared modules.
export { validateExpenseInput, validateTriageInput }
export type { ExpenseInput, TriageInput }

// FK ids for editing/filtering + joined names for display.
export const EXPENSE_SELECT =
  'id, date, details, amount_cents, paid_by, category_id, vendor_id, location_id, ' +
  'category:expense_categories(name), vendor:vendors(name), location:locations(name)'

type RawExpense = {
  id: string; date: string; details: string | null; amount_cents: number; paid_by: Member | null
  category_id: string | null; vendor_id: string | null; location_id: string | null
  category: { name: string } | null; vendor: { name: string } | null; location: { name: string } | null
}

export function mapExpenseRow(r: RawExpense): ExpenseRow {
  return {
    id: r.id, date: r.date, details: r.details, amount_cents: r.amount_cents, paid_by: r.paid_by,
    category_id: r.category_id, vendor_id: r.vendor_id, location_id: r.location_id,
    category_name: r.category?.name ?? null,
    vendor_name: r.vendor?.name ?? null,
    location_name: r.location?.name ?? null,
  }
}

export async function listExpenses(opts?: { year?: number; month?: number }): Promise<ExpenseRow[]> {
  const m = await getMembership()
  if (!m) return []
  const supabase = await createClient()
  let q = supabase.from('expenses').select(EXPENSE_SELECT).eq('household_id', m.householdId).order('date', { ascending: false })
  if (opts?.year && opts?.month) {
    const { startISO, endISO } = monthRange(opts.year, opts.month)
    q = q.gte('date', startISO).lt('date', endISO)
  }
  const { data, error } = await q
  if (error) { console.error('listExpenses failed:', error.message); return [] }
  return (data ?? []).map((r) => mapExpenseRow(r as unknown as RawExpense))
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
    .from('expenses').select(EXPENSE_SELECT).eq('id', id).eq('household_id', m.householdId).single()
  if (error || !data) {
    if (error && error.code !== 'PGRST116') console.error('getExpense failed:', error.message)
    return null
  }
  return mapExpenseRow(data as unknown as RawExpense)
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
    details: input.note,
    category_id: input.categoryId,
    vendor_id: input.vendorId,
    location_id: input.locationId,
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
    details: input.note,
    category_id: input.categoryId,
    vendor_id: input.vendorId,
    location_id: input.locationId,
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
    .select(EXPENSE_SELECT)
    .eq('household_id', m.householdId)
    .or('category_id.is.null,paid_by.is.null')
    .order('date', { ascending: true })
  if (error) { console.error('listExpensesNeedingTriage failed:', error.message); return [] }
  return (data ?? []).map((r) => mapExpenseRow(r as unknown as RawExpense))
}

export async function countExpensesNeedingTriage(): Promise<number> {
  const m = await getMembership()
  if (!m) return 0
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('expenses')
    .select('id', { count: 'exact', head: true })
    .eq('household_id', m.householdId)
    .or('category_id.is.null,paid_by.is.null')
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
    .update({ category_id: input.categoryId, paid_by: input.paidBy })
    .eq('id', id)
    .eq('household_id', m.householdId)
  if (error) { console.error('setExpenseCategoryPaidBy failed:', error.message); return { ok: false, error: 'save_failed' } }
  return { ok: true }
}
