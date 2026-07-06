import { describe, it, expect } from 'vitest'
import { monthRange, monthKey, sumCents, groupByDay, formatMonthYear, monthShort } from './summary'
import type { ExpenseRow } from './types'

describe('formatMonthYear', () => {
  it('formats en and zh', () => {
    expect(formatMonthYear(2026, 7, 'en')).toBe('July 2026')
    expect(formatMonthYear(2026, 7, 'zh')).toBe('2026年7月')
    expect(formatMonthYear(2026, 12, 'en')).toBe('December 2026')
  })
})

const row = (id: string, date: string, amount_cents: number): ExpenseRow =>
  ({ id, date, details: null, amount_cents, paid_by: null,
     category_id: null, vendor_id: null, location_id: null,
     category_name: null, vendor_name: null, location_name: null })

describe('monthShort', () => {
  it('formats en and zh short month labels', () => {
    expect(monthShort(7, 'en')).toBe('Jul')
    expect(monthShort(7, 'zh')).toBe('7月')
    expect(monthShort(1, 'en')).toBe('Jan')
    expect(monthShort(12, 'zh')).toBe('12月')
  })
})

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
