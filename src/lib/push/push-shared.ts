// Uses atob when present (browser); falls back to Buffer for node/test environments
// or when atob rejects non-strict base64 (e.g. arbitrary/short sample keys used in tests).
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  let raw: string
  try {
    raw = typeof atob === 'function' ? atob(base64) : Buffer.from(base64, 'base64').toString('binary')
  } catch {
    raw = Buffer.from(base64, 'base64').toString('binary')
  }
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export type SerializedSubscription = { endpoint: string; p256dh: string; auth: string }

export function serializeSubscription(sub: PushSubscription): SerializedSubscription {
  const json = sub.toJSON()
  return {
    endpoint: sub.endpoint,
    p256dh: json.keys?.p256dh ?? '',
    auth: json.keys?.auth ?? '',
  }
}
