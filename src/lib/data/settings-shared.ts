export type MemberCode = 'CH' | 'JC'
export type MemberRow = { code: MemberCode; displayName: string; role: 'owner' | 'member' }
export type SettingsData = {
  members: MemberRow[]
  language: 'en' | 'zh'
  reminders: { monthly: boolean; yearly: boolean }
  pushSubscribed: boolean
}

// Pragmatic email check — one @, a dot in the domain, no spaces.
export function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}
