import { describe, it, expect } from 'vitest'
import manifest from './manifest'

describe('manifest', () => {
  it('is standalone, named Kita, terracotta theme, with 192/512/maskable icons', () => {
    const m = manifest()
    expect(m.name).toBe('Kita')
    expect(m.short_name).toBe('Kita')
    expect(m.display).toBe('standalone')
    expect(m.start_url).toBe('/')
    expect(m.theme_color).toBe('#c4623d')
    const sizes = (m.icons ?? []).map((i) => i.sizes)
    expect(sizes).toContain('192x192')
    expect(sizes).toContain('512x512')
    const maskable = (m.icons ?? []).find((i) => i.purpose === 'maskable')
    expect(maskable?.src).toContain('maskable')
  })
})
