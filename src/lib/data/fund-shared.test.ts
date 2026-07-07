import { describe, it, expect } from 'vitest'
import {
  periodISOForMonth, yearOf, monthOf,
  filterRecords, filteredTotal, totalContributedThisYear,
  type FundRecord,
} from './fund-shared'

const recs: FundRecord[] = [
  { id: 'a', memberCode: 'CH', periodISO: '2026-01-01', amountCents: 293926, notes: null },
  { id: 'b', memberCode: 'JC', periodISO: '2026-01-01', amountCents: 313926, notes: null },
  { id: 'c', memberCode: 'CH', periodISO: '2026-02-01', amountCents: 227000, notes: null },
  { id: 'd', memberCode: 'CH', periodISO: '2025-12-01', amountCents: 66926, notes: null },
]

describe('period helpers', () => {
  it('formats first-of-month ISO with zero padding', () => {
    expect(periodISOForMonth(2026, 3)).toBe('2026-03-01')
    expect(periodISOForMonth(2026, 11)).toBe('2026-11-01')
  })
  it('reads year and month back out', () => {
    expect(yearOf('2026-02-01')).toBe(2026)
    expect(monthOf('2026-02-01')).toBe(2)
  })
})

describe('filterRecords', () => {
  it('defaults (all/all/year) keep only that year, newest first', () => {
    const out = filterRecords(recs, { member: 'all', month: 'all', year: 2026 })
    expect(out.map((r) => r.id)).toEqual(['c', 'a', 'b'])
  })
  it('filters by member', () => {
    const out = filterRecords(recs, { member: 'JC', month: 'all', year: 2026 })
    expect(out.map((r) => r.id)).toEqual(['b'])
  })
  it('filters by month', () => {
    const out = filterRecords(recs, { member: 'all', month: 1, year: 2026 })
    expect(out.map((r) => r.id).sort()).toEqual(['a', 'b'])
  })
  it('filters by year', () => {
    const out = filterRecords(recs, { member: 'CH', month: 'all', year: 2025 })
    expect(out.map((r) => r.id)).toEqual(['d'])
  })
})

describe('totals', () => {
  it('filteredTotal sums the filtered set', () => {
    expect(filteredTotal(recs, { member: 'all', month: 1, year: 2026 })).toBe(293926 + 313926)
  })
  it('totalContributedThisYear sums all records in the year regardless of other filters', () => {
    expect(totalContributedThisYear(recs, 2026)).toBe(293926 + 313926 + 227000)
    expect(totalContributedThisYear(recs, 2025)).toBe(66926)
  })
})
