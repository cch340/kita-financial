import { describe, it, expect } from 'vitest'
import { isValidEmail } from './settings-shared'

describe('isValidEmail', () => {
  it('accepts a normal address', () => {
    expect(isValidEmail('jc@example.com')).toBe(true)
  })
  it('rejects blanks and malformed', () => {
    expect(isValidEmail('')).toBe(false)
    expect(isValidEmail('nope')).toBe(false)
    expect(isValidEmail('a@b')).toBe(false)
    expect(isValidEmail('a b@c.com')).toBe(false)
  })
})
