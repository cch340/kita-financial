import { createClient } from '@/lib/supabase/server'
import { getMembership } from './household'
import { monthRange } from './summary'
import type { ExpenseRow } from './types'

const COLS = 'id, date, vendor, details, category, amount_cents, paid_by'

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
  if (error || !data) return []
  return data as ExpenseRow[]
}

export async function getMonthTotalCents(year: number, month: number): Promise<number> {
  const rows = await listExpenses({ year, month })
  return rows.reduce((a, r) => a + r.amount_cents, 0)
}

export async function addExpense(input: {
  amountCents: number; category: string | null; paidBy: 'CH' | 'JC' | null; note: string | null; dateISO: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'Not authenticated' }
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) return { ok: false, error: 'Enter an amount' }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase.from('expenses').insert({
    household_id: m.householdId,
    date: input.dateISO,
    details: input.note,
    category: input.category,
    amount_cents: input.amountCents,
    paid_by: input.paidBy,
    created_by: user?.id ?? null,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function deleteExpense(id: string): Promise<void> {
  const m = await getMembership()
  if (!m) return
  const supabase = await createClient()
  await supabase.from('expenses').delete().eq('id', id).eq('household_id', m.householdId)
}
