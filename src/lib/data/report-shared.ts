// Pure, server/client-safe report aggregation — no supabase / next/headers here.
// Client components, the export route, and vitest all import these directly.
import { CATEGORIES } from '@/lib/categories'
import type { ExpenseRow } from './types'
import type { LedgerEntry } from './personal-shared'

export type CategoryMonthMatrix = {
  categories: string[]
  cells: Record<string, number[]>
  categoryTotals: Record<string, number>
  monthTotals: number[]
  grandTotalCents: number
}

/** Category ordering for the matrix: defined categories first, 'uncategorized' last. */
const CATEGORY_ORDER: string[] = [...CATEGORIES.map((c) => c.key as string), 'uncategorized']

export function buildCategoryMonthMatrix(rows: ExpenseRow[], year: number): CategoryMonthMatrix {
  const yearStr = String(year)
  const cells: Record<string, number[]> = {}
  for (const r of rows) {
    if (r.date.slice(0, 4) !== yearStr) continue
    const monthIndex = Number(r.date.slice(5, 7)) - 1
    if (monthIndex < 0 || monthIndex > 11) continue
    const key = r.category ?? 'uncategorized'
    ;(cells[key] ??= Array(12).fill(0))[monthIndex] += r.amount_cents
  }

  const categories = CATEGORY_ORDER.filter((k) => k in cells)
  const categoryTotals: Record<string, number> = {}
  const monthTotals = Array(12).fill(0)
  for (const key of categories) {
    const row = cells[key]
    categoryTotals[key] = row.reduce((a, b) => a + b, 0)
    for (let i = 0; i < 12; i++) monthTotals[i] += row[i]
  }
  const grandTotalCents = monthTotals.reduce((a, b) => a + b, 0)

  return { categories, cells, categoryTotals, monthTotals, grandTotalCents }
}

export function personalBalanceTrend(entries: LedgerEntry[], year: number): number[] {
  const yearStr = String(year)
  const trend = Array(12).fill(0)
  for (const e of entries) {
    if (e.period.slice(0, 4) !== yearStr) continue
    const monthIndex = Number(e.period.slice(5, 7)) - 1
    if (monthIndex < 0 || monthIndex > 11) continue
    trend[monthIndex] += e.entryType === 'income' ? e.amountCents : -e.amountCents
  }
  return trend
}
