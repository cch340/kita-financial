import { describe, it, expect } from 'vitest'
import { expenseKeysForBudget, spentForBudgetCategory } from './budget'

describe('expenseKeysForBudget', () => {
  it('maps budget category names to expense category keys (leo wins over food)', () => {
    expect(expenseKeysForBudget('House')).toEqual(['house', 'utilities'])
    expect(expenseKeysForBudget('Food')).toEqual(['food', 'groceries', 'dining'])
    expect(expenseKeysForBudget('Leo Food + diapers')).toEqual(['leo'])
    expect(expenseKeysForBudget('Emergency fund')).toEqual([])
  })
})
describe('spentForBudgetCategory', () => {
  it('sums the mapped expense-category totals', () => {
    const byKey = { food: 5000, groceries: 3000, dining: 2000, leo: 4000, house: 1000 }
    expect(spentForBudgetCategory('Food', byKey)).toBe(10000) // 5000+3000+2000
    expect(spentForBudgetCategory('Leo Clothes', byKey)).toBe(4000)
    expect(spentForBudgetCategory('Emergency fund', byKey)).toBe(0)
  })
})
