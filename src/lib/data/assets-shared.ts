// Pure, server/client-safe asset helpers and types — no supabase import here.
// Kept separate from assets.ts so client components can import these without
// pulling in `next/headers` (via createClient) through getAssetsList/getAsset.
export type AssetType = 'property' | 'vehicle' | 'investment' | 'other'
export type AssetTxn = {
  id: string; date: string; description: string | null; amountCents: number
  direction: 'in' | 'out'; txnType: string | null; settled: boolean; seq: number | null; notes: string | null
}
export type Asset = {
  id: string; type: AssetType; name: string; ownerMemberCode: 'CH' | 'JC' | null
  status: 'active' | 'closed'; openingBalanceCents: number | null; metadata: Record<string, unknown>
}
export type KeyFigure = { label: 'balance' | 'next_payment' | 'paid'; amountCents: number }

export function runningBalanceCents(openingCents: number | null, txns: AssetTxn[]): number {
  return (openingCents ?? 0) + txns.reduce((a, t) => a + (t.direction === 'in' ? t.amountCents : -t.amountCents), 0)
}
export function totalSettledOutCents(txns: AssetTxn[]): number {
  return txns.filter((t) => t.settled && t.direction === 'out').reduce((a, t) => a + t.amountCents, 0)
}
export function nextPaymentCents(txns: AssetTxn[]): number {
  const unsettled = txns.filter((t) => !t.settled).slice().sort((a, b) => (a.date < b.date ? -1 : 1))
  return unsettled.length ? unsettled[0].amountCents : 0
}
export function assetKeyFigure(asset: Asset, txns: AssetTxn[]): KeyFigure {
  if (asset.type === 'investment') return { label: 'paid', amountCents: totalSettledOutCents(txns) }
  if (asset.type === 'vehicle') return { label: 'next_payment', amountCents: nextPaymentCents(txns) }
  return { label: 'balance', amountCents: runningBalanceCents(asset.openingBalanceCents, txns) }
}
export function groupByTxnType(txns: AssetTxn[]): { txnType: string; rows: AssetTxn[] }[] {
  const order: string[] = []
  const map = new Map<string, AssetTxn[]>()
  for (const t of txns) {
    const k = t.txnType ?? 'other'
    if (!map.has(k)) { map.set(k, []); order.push(k) }
    map.get(k)!.push(t)
  }
  return order.map((k) => ({ txnType: k, rows: map.get(k)! }))
}
