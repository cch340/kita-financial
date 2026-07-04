import { describe, it, expect } from 'vitest'
import { formatRM, pushDigit, pushDoubleZero, backspace } from './money'

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
