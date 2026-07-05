import { describe, it, expect } from 'vitest'
import { needsTriage, countNeedingTriage, validateTriageInput, type TriageInput } from './triage-shared'
import { isCategoryKey } from '@/lib/categories'

describe('isCategoryKey', () => {
  it('accepts real category keys and rejects everything else', () => {
    expect(isCategoryKey('food')).toBe(true)
    expect(isCategoryKey('health')).toBe(true)
    expect(isCategoryKey('uncategorized')).toBe(false)
    expect(isCategoryKey('nope')).toBe(false)
  })
})

describe('needsTriage', () => {
  it('is true when category OR paid_by is missing', () => {
    expect(needsTriage({ category: null, paid_by: 'CH' })).toBe(true)
    expect(needsTriage({ category: 'food', paid_by: null })).toBe(true)
    expect(needsTriage({ category: null, paid_by: null })).toBe(true)
  })
  it('is false when both are present', () => {
    expect(needsTriage({ category: 'food', paid_by: 'CH' })).toBe(false)
  })
})

describe('countNeedingTriage', () => {
  it('counts only rows missing category or paid_by', () => {
    const rows = [
      { category: 'food', paid_by: 'CH' as const },
      { category: null, paid_by: 'JC' as const },
      { category: 'health', paid_by: null },
      { category: null, paid_by: null },
    ]
    expect(countNeedingTriage(rows)).toBe(3)
  })
  it('is 0 for an empty list', () => {
    expect(countNeedingTriage([])).toBe(0)
  })
})

describe('validateTriageInput', () => {
  const ok: TriageInput = { category: 'groceries', paidBy: 'JC' }
  it('accepts a valid category + member', () => {
    expect(validateTriageInput(ok)).toEqual({ ok: true })
  })
  it('rejects a missing or unknown category', () => {
    expect(validateTriageInput({ ...ok, category: null })).toEqual({ ok: false, error: 'invalid_category' })
    expect(validateTriageInput({ ...ok, category: 'uncategorized' })).toEqual({ ok: false, error: 'invalid_category' })
    expect(validateTriageInput({ ...ok, category: 'bogus' })).toEqual({ ok: false, error: 'invalid_category' })
  })
  it('rejects a missing or invalid member', () => {
    expect(validateTriageInput({ ...ok, paidBy: null })).toEqual({ ok: false, error: 'invalid_member' })
    expect(validateTriageInput({ ...ok, paidBy: 'ZZ' as unknown as 'CH' })).toEqual({ ok: false, error: 'invalid_member' })
  })
})
