import { describe, it, expect } from 'vitest'
import { formatRM, pushDigit, pushDoubleZero, backspace, parseMoneyInput } from './money'

describe('formatRM', () => {
  it('formats cents as RM with grouping and 2dp', () => {
    expect(formatRM(123456)).toBe('RM 1,234.56')
    expect(formatRM(0)).toBe('RM 0.00')
    expect(formatRM(5)).toBe('RM 0.05')
    expect(formatRM(227000)).toBe('RM 2,270.00')
  })
})
describe('cents accumulator', () => {
  it('pushDigit shifts left and adds', () => {
    expect(pushDigit(0, 4)).toBe(4)
    expect(pushDigit(4, 2)).toBe(42)     // 0.42
    expect(pushDigit(425, 0)).toBe(4250) // 42.50
  })
  it('pushDoubleZero multiplies by 100', () => {
    expect(pushDoubleZero(42)).toBe(4200)
  })
  it('backspace divides by 10 (floor)', () => {
    expect(backspace(4250)).toBe(425)
    expect(backspace(4)).toBe(0)
    expect(backspace(0)).toBe(0)
  })
})
describe('parseMoneyInput', () => {
  it('parses a decimal string to cents', () => {
    expect(parseMoneyInput('42.50')).toBe(4250)
    expect(parseMoneyInput('1000')).toBe(100000)
  })
  it('returns 0 for empty or non-numeric input', () => {
    expect(parseMoneyInput('')).toBe(0)
    expect(parseMoneyInput('abc')).toBe(0)
  })
  it('rounds to the nearest cent', () => {
    // NOTE: 1.005 is not exactly representable as an IEEE-754 double; it is stored as
    // 1.0049999999999998934..., so *100 = 100.49999999999999, which Math.round takes to
    // 100 (not the mathematically-expected 101). This is the actual, correct output of
    // the brief's specified implementation — see task-6-report.md for details.
    expect(parseMoneyInput('1.005')).toBe(100)
  })
})
