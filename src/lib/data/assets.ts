import { createClient } from '@/lib/supabase/server'
import { getMembership } from './household'
import { assetKeyFigure, type Asset, type AssetTxn, type AssetType, type KeyFigure } from './assets-shared'

const TYPE_ORDER: AssetType[] = ['property', 'vehicle', 'investment', 'other']
const ASSET_COLS = 'id, type, name, owner_member_code, status, opening_balance_cents, metadata'
const TXN_COLS = 'id, date, description, amount_cents, direction, txn_type, settled, seq, notes'
// Literal (not concatenated) so Supabase preserves the select's row type.
const TXN_COLS_WITH_ASSET = 'asset_id, id, date, description, amount_cents, direction, txn_type, settled, seq, notes'

function mapAsset(r: Record<string, unknown>): Asset {
  return {
    id: r.id as string, type: r.type as AssetType, name: r.name as string,
    ownerMemberCode: (r.owner_member_code as 'CH' | 'JC' | null) ?? null,
    status: r.status as 'active' | 'closed', openingBalanceCents: (r.opening_balance_cents as number | null) ?? null,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
  }
}
function mapTxn(r: Record<string, unknown>): AssetTxn {
  return {
    id: r.id as string, date: r.date as string, description: (r.description as string | null) ?? null,
    amountCents: r.amount_cents as number, direction: r.direction as 'in' | 'out',
    txnType: (r.txn_type as string | null) ?? null, settled: r.settled as boolean,
    seq: (r.seq as number | null) ?? null, notes: (r.notes as string | null) ?? null,
  }
}

export async function getAssetsList(): Promise<{ type: AssetType; assets: (Asset & { key: KeyFigure })[] }[]> {
  const m = await getMembership()
  if (!m) return []
  const supabase = await createClient()
  const [assetsRes, txnsRes] = await Promise.all([
    supabase.from('assets').select(ASSET_COLS).eq('household_id', m.householdId).order('sort_order', { ascending: true }),
    supabase.from('asset_transactions').select(TXN_COLS_WITH_ASSET).eq('household_id', m.householdId),
  ])
  if (assetsRes.error) console.error('getAssetsList assets:', assetsRes.error.message)
  if (txnsRes.error) console.error('getAssetsList txns:', txnsRes.error.message)
  const assets = (assetsRes.data ?? []).map(mapAsset)
  const txnRows = (txnsRes.data ?? []) as unknown as (Record<string, unknown> & { asset_id: string })[]
  const byAsset = new Map<string, AssetTxn[]>()
  for (const r of txnRows) {
    const list = byAsset.get(r.asset_id) ?? []
    list.push(mapTxn(r)); byAsset.set(r.asset_id, list)
  }
  const withKey = assets.map((a) => ({ ...a, key: assetKeyFigure(a, byAsset.get(a.id) ?? []) }))
  return TYPE_ORDER.map((type) => ({ type, assets: withKey.filter((a) => a.type === type) })).filter((g) => g.assets.length > 0)
}

export async function getAsset(id: string): Promise<{ asset: Asset; txns: AssetTxn[] } | null> {
  const m = await getMembership()
  if (!m) return null
  const supabase = await createClient()
  const { data: aRow, error: aErr } = await supabase
    .from('assets').select(ASSET_COLS).eq('household_id', m.householdId).eq('id', id).single()
  if (aErr || !aRow) { if (aErr) console.error('getAsset:', aErr.message); return null }
  const { data: tRows, error: tErr } = await supabase
    .from('asset_transactions').select(TXN_COLS).eq('household_id', m.householdId).eq('asset_id', id)
    .order('date', { ascending: false })
  if (tErr) console.error('getAsset txns:', tErr.message)
  return { asset: mapAsset(aRow), txns: (tRows ?? []).map(mapTxn) }
}
