import { describe, it, expect } from 'vitest'
import { sumByType, balanceCents, validateLedgerInput, pickCopySourceMonth } from './personal-shared'
import type { LedgerEntry } from './personal-shared'

const e = (entryType: 'income' | 'expense', amountCents: number): LedgerEntry => ({
  id: 'x',
  ownerMemberCode: 'CH',
  period: '2026-01-01',
  entryType,
  description: 'd',
  amountCents,
  remark: null,
})

describe('personal-shared', () => {
  it('sumByType and balance', () => {
    const rows = [e('income', 10000), e('income', 5000), e('expense', 3000)]
    expect(sumByType(rows, 'income')).toBe(15000)
    expect(sumByType(rows, 'expense')).toBe(3000)
    expect(balanceCents(rows)).toBe(12000)
  })

  it('handles empty entries without dividing by zero', () => {
    expect(sumByType([], 'income')).toBe(0)
    expect(sumByType([], 'expense')).toBe(0)
    expect(balanceCents([])).toBe(0)
  })
})

describe('validateLedgerInput', () => {
  const base = { entryType: 'expense' as const, description: 'Lunch', amountCents: 1500 }
  it('accepts a valid entry', () => {
    expect(validateLedgerInput(base)).toEqual({ ok: true })
  })
  it('rejects an empty description', () => {
    expect(validateLedgerInput({ ...base, description: '   ' })).toEqual({ ok: false, error: 'invalid_description' })
  })
  it('rejects a bad type', () => {
    expect(validateLedgerInput({ ...base, entryType: 'x' as unknown as 'income' })).toEqual({ ok: false, error: 'invalid_type' })
  })
  it('rejects a non-positive amount', () => {
    expect(validateLedgerInput({ ...base, amountCents: 0 })).toEqual({ ok: false, error: 'invalid_amount' })
  })
})

describe('pickCopySourceMonth', () => {
  it('returns the most recent month strictly before the target', () => {
    const months = ['2026-06-01', '2026-05-01', '2026-04-01']
    expect(pickCopySourceMonth(months, '2026-07-01')).toBe('2026-06-01')
  })
  it('ignores the target month itself and any later months', () => {
    const months = ['2026-08-01', '2026-07-01', '2026-06-01']
    expect(pickCopySourceMonth(months, '2026-07-01')).toBe('2026-06-01')
  })
  it('does not assume input ordering', () => {
    const months = ['2026-04-01', '2026-06-01', '2026-05-01']
    expect(pickCopySourceMonth(months, '2026-07-01')).toBe('2026-06-01')
  })
  it('returns null when there is no earlier month', () => {
    expect(pickCopySourceMonth(['2026-07-01'], '2026-07-01')).toBeNull()
    expect(pickCopySourceMonth([], '2026-07-01')).toBeNull()
  })
})
