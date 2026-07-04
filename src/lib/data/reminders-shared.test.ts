import { describe, it, expect } from 'vitest'
import { dueReminders } from './reminders-shared'

const rec = (o: Partial<{ userId: string; monthly: boolean; yearly: boolean }> = {}) => ({
  userId: o.userId ?? 'u1', language: 'en' as const,
  monthly: o.monthly ?? true, yearly: o.yearly ?? true,
})

describe('dueReminders', () => {
  it('fires monthly on the 1st when commitments exist and enabled', () => {
    const out = dueReminders('2026-08-01', { hasMonthlyCommitments: true, bigPayments: [], recipients: [rec()] })
    expect(out).toContainEqual({ userId: 'u1', kind: 'monthly' })
  })
  it('does not fire monthly on a non-first day', () => {
    const out = dueReminders('2026-08-15', { hasMonthlyCommitments: true, bigPayments: [], recipients: [rec()] })
    expect(out.find((r) => r.kind === 'monthly')).toBeUndefined()
  })
  it('skips monthly when the recipient disabled it', () => {
    const out = dueReminders('2026-08-01', { hasMonthlyCommitments: true, bigPayments: [], recipients: [rec({ monthly: false })] })
    expect(out.length).toBe(0)
  })
  it('skips monthly when there are no commitments', () => {
    const out = dueReminders('2026-08-01', { hasMonthlyCommitments: false, bigPayments: [], recipients: [rec()] })
    expect(out.find((r) => r.kind === 'monthly')).toBeUndefined()
  })
  it('fires yearly when a big payment is within 7 days', () => {
    const out = dueReminders('2026-09-01', { hasMonthlyCommitments: false, bigPayments: [{ dateISO: '2026-09-05' }], recipients: [rec()] })
    expect(out).toContainEqual({ userId: 'u1', kind: 'yearly' })
  })
  it('does not fire yearly for a payment far away', () => {
    const out = dueReminders('2026-09-01', { hasMonthlyCommitments: false, bigPayments: [{ dateISO: '2026-12-01' }], recipients: [rec()] })
    expect(out.find((r) => r.kind === 'yearly')).toBeUndefined()
  })
  it('skips yearly when the recipient disabled it', () => {
    const out = dueReminders('2026-09-01', { hasMonthlyCommitments: false, bigPayments: [{ dateISO: '2026-09-05' }], recipients: [rec({ yearly: false })] })
    expect(out.length).toBe(0)
  })
})
