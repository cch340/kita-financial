import { describe, it, expect } from 'vitest'
import {
  normalizeName, findCaseInsensitiveDuplicate, nextSortOrder,
  type CatalogItem,
} from './catalog-shared'

const item = (id: string, name: string, sort_order = 0): CatalogItem => ({ id, name, sort_order })

describe('normalizeName', () => {
  it('trims and collapses inner whitespace', () => {
    expect(normalizeName('  Jaya   Grocer  ')).toBe('Jaya Grocer')
    expect(normalizeName('Aeon')).toBe('Aeon')
  })
})

describe('findCaseInsensitiveDuplicate', () => {
  const existing = [item('1', 'Aeon'), item('2', 'Jaya Grocer')]
  it('matches ignoring case and surrounding space', () => {
    expect(findCaseInsensitiveDuplicate('  aeon ', existing)?.id).toBe('1')
    expect(findCaseInsensitiveDuplicate('AEON', existing)?.id).toBe('1')
  })
  it('returns null when no match', () => {
    expect(findCaseInsensitiveDuplicate('Lotus', existing)).toBeNull()
  })
  it('excludes a given id (for rename of self)', () => {
    expect(findCaseInsensitiveDuplicate('Aeon', existing, '1')).toBeNull()
  })
})

describe('nextSortOrder', () => {
  it('is 0 for empty, else max+1', () => {
    expect(nextSortOrder([])).toBe(0)
    expect(nextSortOrder([item('1', 'a', 0), item('2', 'b', 5)])).toBe(6)
  })
})
