import { createClient } from '@/lib/supabase/server'
import { getMembership } from './household'
import type { AssetCategory, AssetType } from './assets-shared'

const CAT_COLS = 'id, asset_type, name, sort_order'

function mapCategory(r: { id: string; asset_type: AssetType; name: string; sort_order: number }): AssetCategory {
  return { id: r.id, assetType: r.asset_type, name: r.name, sortOrder: r.sort_order }
}

export async function getAssetCategories(): Promise<AssetCategory[]> {
  const m = await getMembership()
  if (!m) return []
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('asset_categories').select(CAT_COLS).eq('household_id', m.householdId)
    .order('asset_type', { ascending: true }).order('sort_order', { ascending: true })
  if (error) { console.error('getAssetCategories:', error.message); return [] }
  return ((data ?? []) as { id: string; asset_type: AssetType; name: string; sort_order: number }[]).map(mapCategory)
}
