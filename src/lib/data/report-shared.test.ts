import { describe, it, expect } from 'vitest'
import { buildCategoryMonthMatrix, personalBalanceTrend } from './report-shared'
import type { ExpenseRow } from './types'
import type { LedgerEntry } from './personal-shared'

const exp = (date: string, category: string | null, cents: number): ExpenseRow => ({
  id: 'x', date, vendor: null, location: null, details: null,
  category, amount_cents: cents, paid_by: null,
})

describe('buildCategoryMonthMatrix', () => {
  it('buckets expenses by category and month', () => {
    const m = buildCategoryMonthMatrix(
      [exp('2026-01-05', 'food', 1000), exp('2026-01-20', 'food', 500), exp('2026-03-10', 'transport', 2000)],
      2026,
    )
    expect(m.cells.food[0]).toBe(1500) // January
    expect(m.cells.food[2]).toBe(0)
    expect(m.cells.transport[2]).toBe(2000) // March
    expect(m.categoryTotals.food).toBe(1500)
    expect(m.monthTotals[0]).toBe(1500)
    expect(m.monthTotals[2]).toBe(2000)
    expect(m.grandTotalCents).toBe(3500)
  })

  it('ignores other years and maps null category to uncategorized, ordered last', () => {
    const m = buildCategoryMonthMatrix(
      [exp('2025-01-05', 'food', 9999), exp('2026-02-05', null, 700), exp('2026-02-06', 'food', 300)],
      2026,
    )
    expect(m.cells.food[1]).toBe(300)
    expect(m.cells.uncategorized[1]).toBe(700)
    expect(m.categories).toEqual(['food', 'uncategorized'])
    expect(m.grandTotalCents).toBe(1000)
  })

  it('returns empty structures when no rows match', () => {
    const m = buildCategoryMonthMatrix([], 2026)
    expect(m.categories).toEqual([])
    expect(m.monthTotals).toEqual(Array(12).fill(0))
    expect(m.grandTotalCents).toBe(0)
  })
})

describe('personalBalanceTrend', () => {
  const led = (period: string, entryType: 'income' | 'expense', cents: number): LedgerEntry => ({
    id: 'x', ownerMemberCode: 'CH', period, entryType, description: 'd', amountCents: cents, remark: null,
  })
  it('computes monthly income minus expense, ignoring other years', () => {
    const trend = personalBalanceTrend(
      [led('2026-01-01', 'income', 5000), led('2026-01-01', 'expense', 2000), led('2025-01-01', 'income', 9999)],
      2026,
    )
    expect(trend[0]).toBe(3000)
    expect(trend[1]).toBe(0)
    expect(trend.length).toBe(12)
  })
})
