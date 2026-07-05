import { describe, it, expect } from 'vitest'
import { validateExpenseInput, parseExpenseForm, type ExpenseInput } from './expenses-shared'

const base: ExpenseInput = {
  dateISO: '2026-07-05', categoryId: 'cat-1', vendorId: null, locationId: null,
  paidBy: 'CH', amountCents: 4250, note: null,
}

describe('validateExpenseInput', () => {
  it('accepts a well-formed input', () => {
    expect(validateExpenseInput(base)).toEqual({ ok: true })
  })
  it('rejects a bad date', () => {
    expect(validateExpenseInput({ ...base, dateISO: '5 July' })).toEqual({ ok: false, error: 'invalid_date' })
    expect(validateExpenseInput({ ...base, dateISO: '' })).toEqual({ ok: false, error: 'invalid_date' })
  })
  it('rejects non-positive or non-integer amounts', () => {
    expect(validateExpenseInput({ ...base, amountCents: 0 })).toEqual({ ok: false, error: 'invalid_amount' })
    expect(validateExpenseInput({ ...base, amountCents: -5 })).toEqual({ ok: false, error: 'invalid_amount' })
    expect(validateExpenseInput({ ...base, amountCents: 1.5 })).toEqual({ ok: false, error: 'invalid_amount' })
  })
  it('rejects an invalid payer but allows null', () => {
    expect(validateExpenseInput({ ...base, paidBy: 'ZZ' as unknown as 'CH' })).toEqual({ ok: false, error: 'invalid_member' })
    expect(validateExpenseInput({ ...base, paidBy: null })).toEqual({ ok: true })
  })
})

describe('parseExpenseForm', () => {
  it('reads fields, trims strings, and empties to null', () => {
    const fd = new FormData()
    fd.set('dateISO', '2026-07-05')
    fd.set('categoryId', '  cat-1  ')
    fd.set('vendorId', '')
    fd.set('locationId', 'loc-1')
    fd.set('paidBy', 'JC')
    fd.set('amountCents', '4250')
    fd.set('note', '  weekly  ')
    expect(parseExpenseForm(fd)).toEqual({
      dateISO: '2026-07-05', categoryId: 'cat-1', vendorId: null, locationId: 'loc-1',
      paidBy: 'JC', amountCents: 4250, note: 'weekly',
    })
  })
  it('coerces an unknown payer to null and categoryId empty to null', () => {
    const fd = new FormData()
    fd.set('dateISO', '2026-07-05')
    fd.set('paidBy', 'XX')
    fd.set('categoryId', '')
    fd.set('amountCents', '100')
    const out = parseExpenseForm(fd)
    expect(out.paidBy).toBeNull()
    expect(out.categoryId).toBeNull()
    expect(out.amountCents).toBe(100)
  })
})
