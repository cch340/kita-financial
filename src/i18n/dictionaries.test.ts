import { describe, it, expect } from 'vitest'
import { t } from './index'
import { dictionaries } from './dictionaries'

describe('locale parity', () => {
  it('every en key (except test.*) has a zh translation', () => {
    const missing = Object.keys(dictionaries.en)
      .filter((k) => !k.startsWith('test.'))
      .filter((k) => !(k in dictionaries.zh))
    expect(missing).toEqual([])
  })
})

describe('t()', () => {
  it('returns the localized string', () => {
    expect(t('en', 'nav.home')).toBe('Home')
    expect(t('zh', 'nav.home')).toBe('首页')
  })
  it('falls back to en when zh key missing', () => {
    expect(t('zh', 'test.only_en')).toBe('English only')
  })
  it('falls back to the key when unknown', () => {
    expect(t('en', 'does.not.exist')).toBe('does.not.exist')
  })
})
