// Pure, server/client-safe asset helpers and types — no supabase import here.
// Kept separate from assets.ts so client components can import these without
// pulling in `next/headers` (via createClient) through getAssetsList/getAsset.
export type AssetType = 'property' | 'vehicle' | 'investment' | 'other'
export type AssetTxn = {
  id: string; date: string; description: string | null; amountCents: number
  direction: 'in' | 'out'; categoryId: string | null; notes: string | null
}
export type Asset = {
  id: string; type: AssetType; name: string; ownerMemberCode: 'CH' | 'JC' | null
  status: 'active' | 'closed'; openingBalanceCents: number | null; metadata: Record<string, unknown>
}
export type AssetCategory = { id: string; assetType: AssetType; name: string; sortOrder: number }
export type CategoryGroup = { categoryId: string | null; name: string; rows: AssetTxn[]; subtotalCents: number }
export type KeyFigure = { label: 'balance'; amountCents: number }

export function runningBalanceCents(openingCents: number | null, txns: AssetTxn[]): number {
  return (openingCents ?? 0) + txns.reduce((a, t) => a + (t.direction === 'in' ? t.amountCents : -t.amountCents), 0)
}

// Every asset type shows the same figure: a running balance.
export function assetKeyFigure(asset: Asset, txns: AssetTxn[]): KeyFigure {
  return { label: 'balance', amountCents: runningBalanceCents(asset.openingBalanceCents, txns) }
}

// Group transactions by category, ordered by each category's sortOrder. Rows whose
// categoryId is null or references an unknown category collapse into a single trailing
// "Other" group. subtotalCents is the sum of transaction magnitudes in the group.
export function groupByCategory(txns: AssetTxn[], categories: AssetCategory[], otherLabel: string): CategoryGroup[] {
  const known = new Set(categories.map((c) => c.id))
  const byId = new Map<string, AssetTxn[]>()
  const other: AssetTxn[] = []
  for (const t of txns) {
    if (t.categoryId && known.has(t.categoryId)) {
      const list = byId.get(t.categoryId) ?? []
      list.push(t); byId.set(t.categoryId, list)
    } else {
      other.push(t)
    }
  }
  const sum = (rows: AssetTxn[]) => rows.reduce((a, r) => a + r.amountCents, 0)
  const groups: CategoryGroup[] = []
  for (const c of [...categories].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const rows = byId.get(c.id)
    if (rows && rows.length) groups.push({ categoryId: c.id, name: c.name, rows, subtotalCents: sum(rows) })
  }
  if (other.length) groups.push({ categoryId: null, name: otherLabel, rows: other, subtotalCents: sum(other) })
  return groups
}

export type TxnInput = {
  date: string
  description: string | null
  amountCents: number
  direction: 'in' | 'out'
  categoryId: string | null
  notes: string | null
}

const TXN_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function validateTxnInput(input: TxnInput): { ok: true } | { ok: false; error: string } {
  if (!TXN_DATE_RE.test(input.date)) return { ok: false, error: 'invalid_date' }
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) return { ok: false, error: 'invalid_amount' }
  if (input.direction !== 'in' && input.direction !== 'out') return { ok: false, error: 'invalid_direction' }
  return { ok: true }
}

export function splitByStatus<T extends { status: 'active' | 'closed' }>(assets: T[]): { active: T[]; closed: T[] } {
  return {
    active: assets.filter((a) => a.status === 'active'),
    closed: assets.filter((a) => a.status === 'closed'),
  }
}
