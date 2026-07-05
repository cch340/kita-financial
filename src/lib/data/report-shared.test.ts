import { describe, it, expect } from 'vitest'
import { buildCategoryMonthMatrix, personalBalanceTrend, UNCATEGORIZED } from './report-shared'
import type { ExpenseRow } from './types'
import type { LedgerEntry } from './personal-shared'

const exp = (date: string, category_name: string | null, cents: number): ExpenseRow => ({
  id: 'x', date, details: null, amount_cents: cents, paid_by: null,
  category_id: category_name ? 'c' : null, vendor_id: null, location_id: null,
  category_name, vendor_name: null, location_name: null,
})

describe('buildCategoryMonthMatrix', () => {
  it('buckets expenses by category name and month', () => {
    const m = buildCategoryMonthMatrix(
      [exp('2026-01-05', 'Food', 1000), exp('2026-01-20', 'Food', 500), exp('2026-03-10', 'Transport', 2000)],
      2026,
    )
    expect(m.cells.Food[0]).toBe(1500)
    expect(m.cells.Transport[2]).toBe(2000)
    expect(m.categoryTotals.Food).toBe(1500)
    expect(m.monthTotals[0]).toBe(1500)
    expect(m.grandTotalCents).toBe(3500)
    expect(m.categories).toEqual(['Food', 'Transport']) // alphabetical
  })

  it('maps null category to the uncategorized bucket, ordered last', () => {
    const m = buildCategoryMonthMatrix(
      [exp('2025-01-05', 'Food', 9999), exp('2026-02-05', null, 700), exp('2026-02-06', 'Food', 300)],
      2026,
    )
    expect(m.cells.Food[1]).toBe(300)
    expect(m.cells[UNCATEGORIZED][1]).toBe(700)
    expect(m.categories).toEqual(['Food', UNCATEGORIZED])
    expect(m.grandTotalCents).toBe(1000)
  })

  it('returns empty structures when no rows match', () => {
    const m = buildCategoryMonthMatrix([], 2026)
    expect(m.categories).toEqual([])
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
    expect(trend.length).toBe(12)
  })
})
