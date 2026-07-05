import { describe, it, expect } from 'vitest'
import { greetingKey, budgetPaceKey } from './home-shared'

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

describe('budgetPaceKey', () => {
  it('is on track when spend is below the pro-rated allowance', () => {
    // Day 15 of 30 → half the month → allowance = 50% of 1000 = 500. Spent 400 < 500.
    expect(budgetPaceKey(40000, 100000, 15, 30)).toBe('home.onTrack')
  })
  it('is over pace when spend exceeds the pro-rated allowance', () => {
    // Day 10 of 30 → allowance = 1/3 of 1000 ≈ 333. Spent 500 > 333.
    expect(budgetPaceKey(50000, 100000, 10, 30)).toBe('home.overPace')
  })
  it('is on track exactly at the allowance boundary', () => {
    expect(budgetPaceKey(50000, 100000, 15, 30)).toBe('home.onTrack')
  })
  it('treats a zero budget as on track (nothing to overspend)', () => {
    expect(budgetPaceKey(0, 0, 15, 30)).toBe('home.onTrack')
  })
  it('is over pace on the last day when spend exceeds the full budget', () => {
    expect(budgetPaceKey(110000, 100000, 30, 30)).toBe('home.overPace')
  })
})
