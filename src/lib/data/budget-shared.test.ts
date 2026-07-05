import { describe, it, expect } from 'vitest'
import { moveItem, localizedName } from './budget-shared'

describe('moveItem', () => {
  it('moves an item up', () => {
    expect(moveItem(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c'])
  })
  it('moves an item down', () => {
    expect(moveItem(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b'])
  })
  it('is a no-op at the top edge', () => {
    expect(moveItem(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c'])
  })
  it('is a no-op at the bottom edge', () => {
    expect(moveItem(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c'])
  })
  it('does not mutate the input', () => {
    const src = ['a', 'b', 'c']
    moveItem(src, 1, 1)
    expect(src).toEqual(['a', 'b', 'c'])
  })
})

describe('localizedName', () => {
  it('returns the English name for en locale', () => {
    expect(localizedName('House', '房贷', 'en')).toBe('House')
  })
  it('returns the Chinese name for zh locale when present', () => {
    expect(localizedName('House', '房贷', 'zh')).toBe('房贷')
  })
  it('falls back to English when zh name is null', () => {
    expect(localizedName('House', null, 'zh')).toBe('House')
  })
  it('falls back to English when zh name is empty', () => {
    expect(localizedName('House', '', 'zh')).toBe('House')
  })
})
