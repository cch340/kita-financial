import { describe, it, expect } from 'vitest'
import { buildFundMonths, collapseLeadingPaid } from './fund'

type Row = { member_code: 'CH' | 'JC'; period: string; amount_cents: number; status: 'paid' | 'pending' }
const r = (member_code: 'CH'|'JC', period: string, amount_cents: number, status: 'paid'|'pending'): Row =>
  ({ member_code, period, amount_cents, status })

describe('buildFundMonths', () => {
  it('produces 12 months with CH/JC cells filled from rows (null when absent)', () => {
    const rows = [
      r('CH', '2026-01-01', 227000, 'paid'),
      r('JC', '2026-01-01', 247000, 'paid'),
      r('CH', '2026-02-01', 227000, 'pending'),
    ]
    const months = buildFundMonths(rows, 2026)
    expect(months).toHaveLength(12)
    expect(months[0]).toEqual({ month: 1, periodISO: '2026-01-01', ch: { amountCents: 227000, status: 'paid' }, jc: { amountCents: 247000, status: 'paid' } })
    expect(months[1].ch).toEqual({ amountCents: 227000, status: 'pending' })
    expect(months[1].jc).toBeNull()
    expect(months[2].ch).toBeNull()
  })
})

describe('collapseLeadingPaid', () => {
  it('collapses the leading run of fully-paid months into a summary', () => {
    const months = buildFundMonths([
      r('CH','2026-01-01',227000,'paid'), r('JC','2026-01-01',247000,'paid'),
      r('CH','2026-02-01',227000,'paid'), r('JC','2026-02-01',247000,'paid'),
      r('CH','2026-03-01',227000,'pending'), r('JC','2026-03-01',247000,'paid'),
    ], 2026)
    const { summary, rest } = collapseLeadingPaid(months)
    expect(summary).toEqual({ throughMonth: 2, count: 2, totalCents: 948000 })
    expect(rest[0].month).toBe(3)
    expect(rest).toHaveLength(10)
  })
  it('returns null summary when the first month is not fully paid', () => {
    const months = buildFundMonths([r('CH','2026-01-01',227000,'pending')], 2026)
    const { summary, rest } = collapseLeadingPaid(months)
    expect(summary).toBeNull()
    expect(rest).toHaveLength(12)
  })
})
