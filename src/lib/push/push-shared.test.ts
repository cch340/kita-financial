import { describe, it, expect } from 'vitest'
import { urlBase64ToUint8Array } from './push-shared'

describe('urlBase64ToUint8Array', () => {
  it('decodes a url-safe base64 VAPID key to bytes', () => {
    const out = urlBase64ToUint8Array('BParzo') // arbitrary url-safe sample
    expect(out).toBeInstanceOf(Uint8Array)
    expect(out.length).toBeGreaterThan(0)
  })
  it('handles padding and url-safe chars (- _) without throwing', () => {
    expect(() => urlBase64ToUint8Array('a-b_c')).not.toThrow()
  })
})
