import { describe, it, expect } from 'vitest'
import { sumByType, balanceCents } from './personal-shared'
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
