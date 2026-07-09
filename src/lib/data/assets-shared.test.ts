import { describe, it, expect } from 'vitest'
import { runningBalanceCents, assetKeyFigure, groupByCategory, validateTxnInput, splitByStatus, type TxnInput, type AssetCategory } from './assets-shared'
import type { AssetTxn, Asset } from './assets-shared'

const tx = (p: Partial<AssetTxn>): AssetTxn => ({
  id: p.id ?? 'x', date: p.date ?? '2026-01-01', description: p.description ?? null,
  amountCents: p.amountCents ?? 0, direction: p.direction ?? 'out',
  categoryId: p.categoryId ?? null, notes: p.notes ?? null,
})
const cat = (id: string, sortOrder: number, name = id): AssetCategory => ({ id, assetType: 'vehicle', name, sortOrder })

describe('runningBalanceCents', () => {
  it('opening + in - out', () => {
    expect(runningBalanceCents(100000, [tx({ direction: 'in', amountCents: 5000 }), tx({ direction: 'out', amountCents: 2000 })])).toBe(103000)
    expect(runningBalanceCents(null, [])).toBe(0)
  })
})

describe('assetKeyFigure', () => {
  const base: Asset = { id: 'a', type: 'property', name: 'T', ownerMemberCode: null, status: 'active', openingBalanceCents: 100000, metadata: {} }
  it('always returns balance for every type', () => {
    expect(assetKeyFigure(base, [tx({ direction: 'in', amountCents: 5000 })])).toEqual({ label: 'balance', amountCents: 105000 })
    expect(assetKeyFigure({ ...base, type: 'vehicle', openingBalanceCents: null }, [tx({ direction: 'out', amountCents: 2000 })])).toEqual({ label: 'balance', amountCents: -2000 })
  })
})

describe('groupByCategory', () => {
  const cats = [cat('c1', 2, 'Loan'), cat('c2', 1, 'Maintenance')]
  it('orders groups by category sortOrder and sums magnitudes', () => {
    const g = groupByCategory(
      [tx({ categoryId: 'c1', amountCents: 100 }), tx({ categoryId: 'c2', amountCents: 40 }), tx({ categoryId: 'c1', amountCents: 200 })],
      cats, 'Other',
    )
    expect(g.map((x) => x.name)).toEqual(['Maintenance', 'Loan'])
    expect(g[1].rows).toHaveLength(2)
    expect(g[1].subtotalCents).toBe(300)
  })
  it('puts null and unknown category rows into a trailing Other group', () => {
    const g = groupByCategory(
      [tx({ categoryId: 'c1', amountCents: 100 }), tx({ categoryId: null, amountCents: 50 }), tx({ categoryId: 'gone', amountCents: 25 })],
      cats, 'Other',
    )
    expect(g.map((x) => x.name)).toEqual(['Loan', 'Other'])
    expect(g[1].categoryId).toBeNull()
    expect(g[1].subtotalCents).toBe(75)
  })
  it('omits categories with no rows and returns [] for no txns', () => {
    expect(groupByCategory([], cats, 'Other')).toEqual([])
    const g = groupByCategory([tx({ categoryId: 'c1', amountCents: 100 })], cats, 'Other')
    expect(g).toHaveLength(1)
  })
})

describe('validateTxnInput', () => {
  const base: TxnInput = { date: '2026-07-05', description: 'Bill', amountCents: 5000, direction: 'out', categoryId: null, notes: null }
  it('accepts a valid txn', () => { expect(validateTxnInput(base)).toEqual({ ok: true }) })
  it('rejects a bad date', () => { expect(validateTxnInput({ ...base, date: 'nope' })).toEqual({ ok: false, error: 'invalid_date' }) })
  it('rejects a non-positive amount', () => { expect(validateTxnInput({ ...base, amountCents: 0 })).toEqual({ ok: false, error: 'invalid_amount' }) })
  it('rejects a bad direction', () => { expect(validateTxnInput({ ...base, direction: 'sideways' as unknown as 'in' })).toEqual({ ok: false, error: 'invalid_direction' }) })
})

describe('splitByStatus', () => {
  it('partitions active and closed preserving order', () => {
    const items = [{ id: '1', status: 'active' as const }, { id: '2', status: 'closed' as const }, { id: '3', status: 'active' as const }]
    const { active, closed } = splitByStatus(items)
    expect(active.map((a) => a.id)).toEqual(['1', '3'])
    expect(closed.map((a) => a.id)).toEqual(['2'])
  })
})
