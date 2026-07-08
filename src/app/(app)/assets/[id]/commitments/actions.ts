'use server'
import { createClient } from '@/lib/supabase/server'
import { getMembership } from '@/lib/data/household'
import { revalidatePath } from 'next/cache'

type Res = { ok: boolean; error?: string }

function revalidate(assetId: string) {
  revalidatePath(`/assets/${assetId}`)
  revalidatePath(`/assets/${assetId}/commitments`)
  revalidatePath('/')
}

export async function createCommitment(input: {
  assetId: string; name: string; amountCents: number; remark: string | null
}): Promise<Res> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }
  if (!input.name.trim()) return { ok: false, error: 'invalid_name' }
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) return { ok: false, error: 'invalid_amount' }
  const supabase = await createClient()
  const { data: maxRow } = await supabase.from('monthly_commitments')
    .select('sort_order').eq('household_id', m.householdId).eq('asset_id', input.assetId)
    .order('sort_order', { ascending: false }).limit(1).maybeSingle()
  const nextOrder = (maxRow?.sort_order ?? 0) + 1
  const { error } = await supabase.from('monthly_commitments').insert({
    household_id: m.householdId, asset_id: input.assetId, name: input.name.trim(),
    amount_cents: input.amountCents, remark: input.remark?.trim() || null, sort_order: nextOrder,
  })
  if (error) { console.error('createCommitment:', error.message); return { ok: false, error: 'save_failed' } }
  revalidate(input.assetId)
  return { ok: true }
}

export async function updateCommitment(input: {
  id: string; assetId: string; name: string; amountCents: number; remark: string | null
}): Promise<Res> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }
  if (!input.name.trim()) return { ok: false, error: 'invalid_name' }
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) return { ok: false, error: 'invalid_amount' }
  const supabase = await createClient()
  const { error } = await supabase.from('monthly_commitments').update({
    name: input.name.trim(), amount_cents: input.amountCents, remark: input.remark?.trim() || null,
  }).eq('id', input.id).eq('household_id', m.householdId).eq('asset_id', input.assetId)
  if (error) { console.error('updateCommitment:', error.message); return { ok: false, error: 'save_failed' } }
  revalidate(input.assetId)
  return { ok: true }
}

export async function deleteCommitment(input: { id: string; assetId: string }): Promise<Res> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }
  const supabase = await createClient()
  const { error } = await supabase.from('monthly_commitments').delete()
    .eq('id', input.id).eq('household_id', m.householdId).eq('asset_id', input.assetId)
  if (error) { console.error('deleteCommitment:', error.message); return { ok: false, error: 'save_failed' } }
  revalidate(input.assetId)
  return { ok: true }
}

export async function reorderCommitments(input: { assetId: string; orderedIds: string[] }): Promise<Res> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }
  const supabase = await createClient()
  for (let i = 0; i < input.orderedIds.length; i++) {
    const { error } = await supabase.from('monthly_commitments')
      .update({ sort_order: i + 1 }).eq('id', input.orderedIds[i]).eq('household_id', m.householdId).eq('asset_id', input.assetId)
    if (error) { console.error('reorderCommitments:', error.message); return { ok: false, error: 'save_failed' } }
  }
  revalidate(input.assetId)
  return { ok: true }
}
