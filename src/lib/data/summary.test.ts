import { describe, it, expect } from 'vitest'
import { monthRange, monthKey, sumCents, groupByDay } from './summary'
import type { ExpenseRow } from './types'

const row = (id: string, date: string, amount_cents: number): ExpenseRow =>
  ({ id, date, vendor: null, details: null, category: null, amount_cents, paid_by: null })

describe('monthRange', () => {
  it('returns [first-of-month, first-of-next-month)', () => {
    expect(monthRange(2026, 7)).toEqual({ startISO: '2026-07-01', endISO: '2026-08-01' })
    expect(monthRange(2026, 12)).toEqual({ startISO: '2026-12-01', endISO: '2027-01-01' })
  })
})
describe('monthKey', () => {
  it('extracts YYYY-MM', () => {
    expect(monthKey('2026-03-14')).toBe('2026-03')
  })
})
describe('sumCents', () => {
  it('sums amount_cents', () => {
    expect(sumCents([{ amount_cents: 100 }, { amount_cents: 250 }])).toBe(350)
    expect(sumCents([])).toBe(0)
  })
})
describe('groupByDay', () => {
  it('groups by date, newest first, with Today/Yesterday labels and per-day totals', () => {
    const rows = [
      row('a', '2026-07-04', 1000),
      row('b', '2026-07-04', 500),
      row('c', '2026-07-03', 2000),
    ]
    const groups = groupByDay(rows, '2026-07-04')
    expect(groups.map(g => g.date)).toEqual(['2026-07-04', '2026-07-03'])
    expect(groups[0].label).toBe('Today')
    expect(groups[0].totalCents).toBe(1500)
    expect(groups[1].label).toBe('Yesterday')
    expect(groups[1].rows.map(r => r.id)).toEqual(['c'])
  })
})
