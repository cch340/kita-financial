import { describe, it, expect } from 'vitest'
import {
  parseLayout, resolveActiveTab, defsFor, DEFAULT_LAYOUT, TAB_IDS, MAX_BAR,
  type NavLayout, type TabId,
} from './nav-shared'

describe('parseLayout', () => {
  it('returns the default layout for null/undefined/garbage', () => {
    expect(parseLayout(null)).toEqual(DEFAULT_LAYOUT)
    expect(parseLayout(undefined)).toEqual(DEFAULT_LAYOUT)
    expect(parseLayout(42)).toEqual(DEFAULT_LAYOUT)
    expect(parseLayout('nope')).toEqual(DEFAULT_LAYOUT)
  })

  it('preserves a valid layout unchanged', () => {
    const layout = { bar: ['home', 'fund'], more: ['expenses', 'budget', 'assets'] }
    expect(parseLayout(layout)).toEqual(layout)
  })

  it('drops unknown ids', () => {
    const out = parseLayout({ bar: ['home', 'bogus'], more: ['expenses'] })
    expect(out.bar).toEqual(['home'])
    expect(out.bar).not.toContain('bogus')
  })

  it('appends missing known ids to more', () => {
    const out = parseLayout({ bar: ['home'], more: ['expenses'] })
    const all = [...out.bar, ...out.more].sort()
    expect(all).toEqual([...TAB_IDS].sort())
  })

  it('deduplicates across bar and more, bar wins', () => {
    const out = parseLayout({ bar: ['home', 'home'], more: ['home', 'expenses'] })
    expect(out.bar).toEqual(['home'])
    expect(out.more).not.toContain('home')
  })

  it('spills over-cap bar items to the front of more', () => {
    const out = parseLayout({
      bar: ['home', 'expenses', 'fund', 'budget', 'assets'], more: [],
    })
    expect(out.bar).toHaveLength(MAX_BAR)
    expect(out.bar).toEqual(['home', 'expenses', 'fund', 'budget'])
    expect(out.more[0]).toBe('assets')
  })

  it('falls back to default when the bar would be empty', () => {
    expect(parseLayout({ bar: [], more: TAB_IDS })).toEqual(DEFAULT_LAYOUT)
  })
})

describe('resolveActiveTab', () => {
  it('matches each bar destination by prefix', () => {
    const l = DEFAULT_LAYOUT
    expect(resolveActiveTab('/', l)).toBe('home')
    expect(resolveActiveTab('/personal', l)).toBe('home')
    expect(resolveActiveTab('/expenses', l)).toBe('expenses')
    expect(resolveActiveTab('/expenses/123', l)).toBe('expenses')
    expect(resolveActiveTab('/fund', l)).toBe('fund')
    expect(resolveActiveTab('/budget', l)).toBe('budget')
  })

  it('resolves the More slot for destinations that live in more', () => {
    expect(resolveActiveTab('/assets', DEFAULT_LAYOUT)).toBe('more')
    expect(resolveActiveTab('/more', DEFAULT_LAYOUT)).toBe('more')
  })

  it('resolves a promoted destination to its own bar slot', () => {
    const promoted: NavLayout = { bar: ['home', 'expenses', 'fund', 'assets'], more: ['budget'] }
    expect(resolveActiveTab('/assets', promoted)).toBe('assets')
    expect(resolveActiveTab('/budget', promoted)).toBe('more')
  })

  it('returns null when nothing matches', () => {
    expect(resolveActiveTab('/login', DEFAULT_LAYOUT)).toBeNull()
  })
})

describe('defsFor', () => {
  it('returns definitions in the given order', () => {
    const defs = defsFor(['budget', 'home'])
    expect(defs.map((d) => d.id)).toEqual(['budget', 'home'])
  })
  it('drops ids with no matching definition', () => {
    const defs = defsFor(['home', 'nope' as TabId])
    expect(defs.map((d) => d.id)).toEqual(['home'])
  })
})
