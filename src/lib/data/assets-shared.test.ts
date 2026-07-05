import { describe, it, expect } from 'vitest'
import { runningBalanceCents, totalSettledOutCents, nextPaymentCents, assetKeyFigure, groupByTxnType, validateTxnInput, type TxnInput } from './assets-shared'
import type { AssetTxn, Asset } from './assets-shared'

const tx = (p: Partial<AssetTxn>): AssetTxn => ({
  id: p.id ?? 'x', date: p.date ?? '2026-01-01', description: null,
  amountCents: p.amountCents ?? 0, direction: p.direction ?? 'out',
  txnType: p.txnType ?? null, settled: p.settled ?? false, seq: p.seq ?? null, notes: null,
})

describe('runningBalanceCents', () => {
  it('opening + in - out', () => {
    expect(runningBalanceCents(100000, [tx({ direction: 'in', amountCents: 5000 }), tx({ direction: 'out', amountCents: 2000 })])).toBe(103000)
    expect(runningBalanceCents(null, [])).toBe(0)
  })
})
describe('totalSettledOutCents', () => {
  it('sums settled out only', () => {
    expect(totalSettledOutCents([tx({ direction: 'out', amountCents: 3000, settled: true }), tx({ direction: 'out', amountCents: 999, settled: false }), tx({ direction: 'in', amountCents: 100, settled: true })])).toBe(3000)
  })
})
describe('nextPaymentCents', () => {
  it('earliest unsettled by date, 0 when none', () => {
    expect(nextPaymentCents([tx({ date: '2026-03-01', amountCents: 500, settled: false }), tx({ date: '2026-02-01', amountCents: 700, settled: false }), tx({ date: '2026-01-01', amountCents: 900, settled: true })])).toBe(700)
    expect(nextPaymentCents([tx({ settled: true, amountCents: 100 })])).toBe(0)
  })
})
describe('assetKeyFigure', () => {
  const base: Asset = { id: 'a', type: 'property', name: 'T', ownerMemberCode: null, status: 'active', openingBalanceCents: 100000, metadata: {} }
  it('property -> balance, investment -> paid, vehicle -> next_payment', () => {
    expect(assetKeyFigure(base, [tx({ direction: 'in', amountCents: 5000 })])).toEqual({ label: 'balance', amountCents: 105000 })
    expect(assetKeyFigure({ ...base, type: 'investment', openingBalanceCents: null }, [tx({ direction: 'out', amountCents: 3600, settled: true })])).toEqual({ label: 'paid', amountCents: 3600 })
    expect(assetKeyFigure({ ...base, type: 'vehicle', openingBalanceCents: null }, [tx({ date: '2026-05-01', amountCents: 620, settled: false })])).toEqual({ label: 'next_payment', amountCents: 620 })
  })
})
describe('groupByTxnType', () => {
  it('groups preserving first-seen order', () => {
    const g = groupByTxnType([tx({ txnType: 'loan' }), tx({ txnType: 'maintenance' }), tx({ txnType: 'loan' })])
    expect(g.map((x) => x.txnType)).toEqual(['loan', 'maintenance'])
    expect(g[0].rows).toHaveLength(2)
  })
})

describe('validateTxnInput', () => {
  const base: TxnInput = {
    date: '2026-07-05', description: 'Bill', amountCents: 5000,
    direction: 'out', txnType: null, settled: false, seq: null, notes: null,
  }
  it('accepts a valid txn', () => {
    expect(validateTxnInput(base)).toEqual({ ok: true })
  })
  it('rejects a bad date', () => {
    expect(validateTxnInput({ ...base, date: 'nope' })).toEqual({ ok: false, error: 'invalid_date' })
  })
  it('rejects a non-positive amount', () => {
    expect(validateTxnInput({ ...base, amountCents: 0 })).toEqual({ ok: false, error: 'invalid_amount' })
  })
  it('rejects a bad direction', () => {
    expect(validateTxnInput({ ...base, direction: 'sideways' as unknown as 'in' })).toEqual({ ok: false, error: 'invalid_direction' })
  })
})
