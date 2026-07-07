import { describe, it, expect } from 'vitest'
import { fanOutRecurring, sumForMember, type RecurringFund } from './recurring-funds-shared'

describe('fanOutRecurring', () => {
  it('creates one insert row per selected member', () => {
    const rows = fanOutRecurring({ name: 'House', amountCents: 104500, remark: null, members: ['CH', 'JC'] })
    expect(rows).toEqual([
      { member_code: 'CH', name: 'House', amount_cents: 104500, remark: null },
      { member_code: 'JC', name: 'House', amount_cents: 104500, remark: null },
    ])
  })
  it('supports a single member', () => {
    const rows = fanOutRecurring({ name: 'Food', amountCents: 20000, remark: 'lunch', members: ['CH'] })
    expect(rows).toEqual([{ member_code: 'CH', name: 'Food', amount_cents: 20000, remark: 'lunch' }])
  })
  it('returns empty when no members selected', () => {
    expect(fanOutRecurring({ name: 'X', amountCents: 100, remark: null, members: [] })).toEqual([])
  })
})

describe('sumForMember', () => {
  const funds: RecurringFund[] = [
    { id: '1', memberCode: 'CH', name: 'House', amountCents: 104500, remark: null, sortOrder: 0 },
    { id: '2', memberCode: 'CH', name: 'Food', amountCents: 20000, remark: null, sortOrder: 1 },
    { id: '3', memberCode: 'JC', name: 'House', amountCents: 104500, remark: null, sortOrder: 0 },
  ]
  it('sums only the given member rows', () => {
    expect(sumForMember('CH', funds)).toBe(124500)
    expect(sumForMember('JC', funds)).toBe(104500)
  })
  it('returns 0 when the member has no rows', () => {
    expect(sumForMember('JC', [funds[0]])).toBe(0)
  })
})
