import { describe, it, expect } from 'vitest'
import { greetingKey } from './home-shared'

describe('greetingKey', () => {
  it('is morning from 05:00 to 11:59', () => {
    expect(greetingKey(5)).toBe('home.greeting.morning')
    expect(greetingKey(11)).toBe('home.greeting.morning')
  })
  it('is afternoon from 12:00 to 17:59', () => {
    expect(greetingKey(12)).toBe('home.greeting.afternoon')
    expect(greetingKey(17)).toBe('home.greeting.afternoon')
  })
  it('is evening from 18:00 to 04:59', () => {
    expect(greetingKey(18)).toBe('home.greeting.evening')
    expect(greetingKey(23)).toBe('home.greeting.evening')
    expect(greetingKey(0)).toBe('home.greeting.evening')
    expect(greetingKey(4)).toBe('home.greeting.evening')
  })
})
