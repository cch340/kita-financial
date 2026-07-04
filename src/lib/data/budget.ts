import { createClient } from '@/lib/supabase/server'
import { getMembership } from './household'
import { monthRange } from './summary'

export type BudgetCategory = { nameEn: string; nameZh: string | null; jcCents: number; chCents: number; totalCents: number; spentCents: number }
export type BudgetCommitment = { nameEn: string; nameZh: string | null; amountCents: number }
export type BudgetData = { overall: { totalCents: number; spentCents: number }; categories: BudgetCategory[]; commitments: BudgetCommitment[] }

// Best-effort: budget-category display names -> expense category keys. 'leo' is
// checked first so "Leo Food + diapers" maps to baby spend, not general food.
export function expenseKeysForBudget(nameEn: string): string[] {
  const n = nameEn.toLowerCase()
  if (n.includes('leo')) return ['leo']
  if (n.includes('food')) return ['food', 'groceries', 'dining']
  if (n.includes('house')) return ['house', 'utilities']
  return []
}
export function spentForBudgetCategory(nameEn: string, byCategoryKey: Record<string, number>): number {
  return expenseKeysForBudget(nameEn).reduce((a, k) => a + (byCategoryKey[k] ?? 0), 0)
}

export async function getBudget(year: number, month: number): Promise<BudgetData> {
  const empty: BudgetData = { overall: { totalCents: 0, spentCents: 0 }, categories: [], commitments: [] }
  const m = await getMembership()
  if (!m) return empty
  const supabase = await createClient()
  const { startISO, endISO } = monthRange(year, month)

  const [catRes, commitRes, expRes] = await Promise.all([
    supabase.from('budget_categories')
      .select('name_en, name_zh, jc_cents, ch_cents, total_cents, sort_order')
      .eq('household_id', m.householdId).order('sort_order', { ascending: true }),
    supabase.from('monthly_commitments')
      .select('name_en, name_zh, amount_cents')
      .eq('household_id', m.householdId),
    supabase.from('expenses')
      .select('category, amount_cents')
      .eq('household_id', m.householdId).gte('date', startISO).lt('date', endISO),
  ])
  if (catRes.error) console.error('getBudget categories:', catRes.error.message)
  if (commitRes.error) console.error('getBudget commitments:', commitRes.error.message)
  if (expRes.error) console.error('getBudget expenses:', expRes.error.message)

  const expenses = (expRes.data ?? []) as { category: string | null; amount_cents: number }[]
  const byCategoryKey: Record<string, number> = {}
  let spentTotal = 0
  for (const e of expenses) {
    spentTotal += e.amount_cents
    const key = e.category ?? 'uncategorized'
    byCategoryKey[key] = (byCategoryKey[key] ?? 0) + e.amount_cents
  }

  const categories: BudgetCategory[] = ((catRes.data ?? []) as {
    name_en: string; name_zh: string | null; jc_cents: number; ch_cents: number; total_cents: number
  }[]).map((c) => ({
    nameEn: c.name_en, nameZh: c.name_zh, jcCents: c.jc_cents, chCents: c.ch_cents,
    totalCents: c.total_cents, spentCents: spentForBudgetCategory(c.name_en, byCategoryKey),
  }))
  const commitments: BudgetCommitment[] = ((commitRes.data ?? []) as {
    name_en: string; name_zh: string | null; amount_cents: number
  }[]).map((c) => ({ nameEn: c.name_en, nameZh: c.name_zh, amountCents: c.amount_cents }))

  const totalCents = categories.reduce((a, c) => a + c.totalCents, 0)
  return { overall: { totalCents, spentCents: spentTotal }, categories, commitments }
}
