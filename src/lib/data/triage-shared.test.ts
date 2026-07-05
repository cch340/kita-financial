import { describe, it, expect } from 'vitest'
import { needsTriage, countNeedingTriage, validateTriageInput, type TriageInput } from './triage-shared'

describe('needsTriage', () => {
  it('is true when category_id OR paid_by is missing', () => {
    expect(needsTriage({ category_id: null, paid_by: 'CH' })).toBe(true)
    expect(needsTriage({ category_id: 'c1', paid_by: null })).toBe(true)
    expect(needsTriage({ category_id: null, paid_by: null })).toBe(true)
  })
  it('is false when both are present', () => {
    expect(needsTriage({ category_id: 'c1', paid_by: 'CH' })).toBe(false)
  })
})

describe('countNeedingTriage', () => {
  it('counts only rows missing category_id or paid_by', () => {
    const rows = [
      { category_id: 'c1', paid_by: 'CH' as const },
      { category_id: null, paid_by: 'JC' as const },
      { category_id: 'c2', paid_by: null },
      { category_id: null, paid_by: null },
    ]
    expect(countNeedingTriage(rows)).toBe(3)
  })
  it('is 0 for an empty list', () => {
    expect(countNeedingTriage([])).toBe(0)
  })
})

describe('validateTriageInput', () => {
  const ok: TriageInput = { categoryId: 'c1', paidBy: 'JC' }
  it('accepts a non-empty category id + member', () => {
    expect(validateTriageInput(ok)).toEqual({ ok: true })
  })
  it('rejects a missing category', () => {
    expect(validateTriageInput({ ...ok, categoryId: null })).toEqual({ ok: false, error: 'invalid_category' })
    expect(validateTriageInput({ ...ok, categoryId: '' })).toEqual({ ok: false, error: 'invalid_category' })
  })
  it('rejects a missing or invalid member', () => {
    expect(validateTriageInput({ ...ok, paidBy: null })).toEqual({ ok: false, error: 'invalid_member' })
    expect(validateTriageInput({ ...ok, paidBy: 'ZZ' as unknown as 'CH' })).toEqual({ ok: false, error: 'invalid_member' })
  })
})
