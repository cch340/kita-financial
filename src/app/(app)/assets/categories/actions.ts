'use server'
import { createClient } from '@/lib/supabase/server'
import { getMembership } from '@/lib/data/household'
import type { AssetType } from '@/lib/data/assets-shared'
import { revalidatePath } from 'next/cache'

type Res = { ok: boolean; error?: string }

function revalidate() {
  revalidatePath('/assets/categories')
  revalidatePath('/assets')
}

async function nextSortOrder(supabase: Awaited<ReturnType<typeof createClient>>, householdId: string, assetType: AssetType): Promise<number> {
  const { data } = await supabase.from('asset_categories')
    .select('sort_order').eq('household_id', householdId).eq('asset_type', assetType)
    .order('sort_order', { ascending: false }).limit(1).maybeSingle()
  return (data?.sort_order ?? 0) + 1
}

export async function createAssetCategory(input: { assetType: AssetType; name: string }): Promise<{ ok: boolean; id?: string; error?: string }> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }
  if (!input.name.trim()) return { ok: false, error: 'invalid_name' }
  const supabase = await createClient()
  const sortOrder = await nextSortOrder(supabase, m.householdId, input.assetType)
  const { data, error } = await supabase.from('asset_categories').insert({
    household_id: m.householdId, asset_type: input.assetType, name: input.name.trim(), sort_order: sortOrder,
  }).select('id').single()
  if (error || !data) { console.error('createAssetCategory:', error?.message); return { ok: false, error: 'save_failed' } }
  revalidate()
  return { ok: true, id: data.id }
}

export async function updateAssetCategory(input: { id: string; name: string; assetType: AssetType }): Promise<Res> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }
  if (!input.name.trim()) return { ok: false, error: 'invalid_name' }
  const supabase = await createClient()
  const { error } = await supabase.from('asset_categories')
    .update({ name: input.name.trim(), asset_type: input.assetType })
    .eq('id', input.id).eq('household_id', m.householdId)
  if (error) { console.error('updateAssetCategory:', error.message); return { ok: false, error: 'save_failed' } }
  revalidate()
  return { ok: true }
}

export async function deleteAssetCategory(input: { id: string }): Promise<Res> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }
  const supabase = await createClient()
  // asset_transactions.category_id is ON DELETE SET NULL — affected transactions
  // fall back into the "Other" group automatically.
  const { error } = await supabase.from('asset_categories').delete()
    .eq('id', input.id).eq('household_id', m.householdId)
  if (error) { console.error('deleteAssetCategory:', error.message); return { ok: false, error: 'save_failed' } }
  revalidate()
  return { ok: true }
}

export async function reorderAssetCategories(input: { assetType: AssetType; orderedIds: string[] }): Promise<Res> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }
  const supabase = await createClient()
  for (let i = 0; i < input.orderedIds.length; i++) {
    const { error } = await supabase.from('asset_categories').update({ sort_order: i + 1 })
      .eq('id', input.orderedIds[i]).eq('household_id', m.householdId).eq('asset_type', input.assetType)
    if (error) { console.error('reorderAssetCategories:', error.message); return { ok: false, error: 'save_failed' } }
  }
  revalidate()
  return { ok: true }
}
