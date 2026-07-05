import { describe, it, expect } from 'vitest'
import { dueReminders, monthCommitmentPosts } from './reminders-shared'

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

const asset = (id: string, amountCents = 197058) => ({ assetId: id, householdId: 'h1', amountCents })

describe('monthCommitmentPosts', () => {
  it('returns nothing on a non-first day', () => {
    expect(monthCommitmentPosts('2026-08-15', [asset('a1')], [])).toEqual([])
  })
  it('posts on the 1st for a configured asset with no existing commitment this month', () => {
    expect(monthCommitmentPosts('2026-08-01', [asset('a1')], [])).toEqual([
      { assetId: 'a1', householdId: 'h1', amountCents: 197058, dateISO: '2026-08-01' },
    ])
  })
  it('skips an asset that already has a commitment this month (any day)', () => {
    const existing = [{ assetId: 'a1', dateISO: '2026-08-01' }]
    expect(monthCommitmentPosts('2026-08-01', [asset('a1')], existing)).toEqual([])
  })
  it('skips based on month, not exact date (commitment dated later in month still counts)', () => {
    const existing = [{ assetId: 'a1', dateISO: '2026-08-03' }]
    expect(monthCommitmentPosts('2026-08-01', [asset('a1')], existing)).toEqual([])
  })
  it('does not skip when the only existing commitment is a different month', () => {
    const existing = [{ assetId: 'a1', dateISO: '2026-07-01' }]
    expect(monthCommitmentPosts('2026-08-01', [asset('a1')], existing)).toEqual([
      { assetId: 'a1', householdId: 'h1', amountCents: 197058, dateISO: '2026-08-01' },
    ])
  })
  it('ignores assets with a zero/absent commitment amount', () => {
    expect(monthCommitmentPosts('2026-08-01', [asset('a1', 0)], [])).toEqual([])
  })
  it('handles multiple assets independently', () => {
    const assets = [asset('a1'), asset('a2', 50000)]
    const existing = [{ assetId: 'a1', dateISO: '2026-08-01' }]
    expect(monthCommitmentPosts('2026-08-01', assets, existing)).toEqual([
      { assetId: 'a2', householdId: 'h1', amountCents: 50000, dateISO: '2026-08-01' },
    ])
  })
})
