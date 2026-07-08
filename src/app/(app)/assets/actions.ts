'use server'
import { createClient } from '@/lib/supabase/server'
import { getMembership } from '@/lib/data/household'
import { validateTxnInput, type TxnInput } from '@/lib/data/assets-shared'
import { revalidatePath } from 'next/cache'

export async function addAssetTransaction(input: {
  assetId: string; date: string; description: string | null; amountCents: number
  direction: 'in' | 'out'; txnType: string | null; settled: boolean
}): Promise<{ ok: boolean; error?: string }> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) return { ok: false, error: 'invalid_amount' }
  const supabase = await createClient()
  // verify asset belongs to this household
  const { data: asset, error: lookupErr } = await supabase.from('assets').select('id').eq('household_id', m.householdId).eq('id', input.assetId).single()
  if (!asset) {
    // PGRST116 = no rows (asset missing or another household's); log anything else.
    if (lookupErr && lookupErr.code !== 'PGRST116') console.error('addAssetTransaction lookup:', lookupErr.message)
    return { ok: false, error: 'not_found' }
  }
  const { error } = await supabase.from('asset_transactions').insert({
    asset_id: input.assetId, household_id: m.householdId, date: input.date,
    description: input.description, amount_cents: input.amountCents, direction: input.direction,
    txn_type: input.txnType, settled: input.settled,
  })
  if (error) { console.error('addAssetTransaction:', error.message); return { ok: false, error: 'save_failed' } }
  revalidatePath(`/assets/${input.assetId}`); revalidatePath('/assets')
  return { ok: true }
}

export async function toggleTransferred(txnId: string): Promise<{ ok: boolean }> {
  const m = await getMembership()
  if (!m) return { ok: false }
  const supabase = await createClient()
  const { data, error } = await supabase.from('asset_transactions')
    .select('id, settled, asset_id').eq('household_id', m.householdId).eq('id', txnId).single()
  if (error || !data) { if (error) console.error('toggleTransferred read:', error.message); return { ok: false } }
  const { error: upErr } = await supabase.from('asset_transactions')
    .update({ settled: !data.settled }).eq('id', txnId).eq('household_id', m.householdId)
  if (upErr) { console.error('toggleTransferred update:', upErr.message); return { ok: false } }
  revalidatePath(`/assets/${data.asset_id}`); revalidatePath('/assets'); revalidatePath('/')
  return { ok: true }
}

export async function updateAssetTransaction(input: {
  id: string; assetId: string
} & TxnInput): Promise<{ ok: boolean; error?: string }> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }
  const valid = validateTxnInput(input)
  if (!valid.ok) return { ok: false, error: valid.error }
  const supabase = await createClient()
  const { error } = await supabase.from('asset_transactions').update({
    date: input.date, description: input.description, amount_cents: input.amountCents,
    direction: input.direction, txn_type: input.txnType, settled: input.settled,
    seq: input.seq, notes: input.notes,
  }).eq('id', input.id).eq('household_id', m.householdId)
  if (error) { console.error('updateAssetTransaction:', error.message); return { ok: false, error: 'save_failed' } }
  revalidatePath(`/assets/${input.assetId}`); revalidatePath('/assets'); revalidatePath('/')
  return { ok: true }
}

export async function updateAsset(input: {
  id: string; name: string; metadata: Record<string, unknown>
}): Promise<{ ok: boolean; error?: string }> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }
  if (!input.name.trim()) return { ok: false, error: 'invalid_name' }
  const supabase = await createClient()
  const { error } = await supabase.from('assets')
    .update({ name: input.name.trim(), metadata: input.metadata })
    .eq('id', input.id).eq('household_id', m.householdId)
  if (error) { console.error('updateAsset:', error.message); return { ok: false, error: 'save_failed' } }
  revalidatePath(`/assets/${input.id}`); revalidatePath('/assets'); revalidatePath('/')
  return { ok: true }
}

export async function setAssetStatus(input: { id: string; status: 'active' | 'closed' }): Promise<{ ok: boolean }> {
  const m = await getMembership()
  if (!m) return { ok: false }
  const supabase = await createClient()
  const { error } = await supabase.from('assets')
    .update({ status: input.status }).eq('id', input.id).eq('household_id', m.householdId)
  if (error) { console.error('setAssetStatus:', error.message); return { ok: false } }
  revalidatePath(`/assets/${input.id}`); revalidatePath('/assets'); revalidatePath('/')
  return { ok: true }
}

export async function deleteAssetTransaction(input: { id: string; assetId: string }): Promise<{ ok: boolean }> {
  const m = await getMembership()
  if (!m) return { ok: false }
  const supabase = await createClient()
  const { error } = await supabase.from('asset_transactions')
    .delete().eq('id', input.id).eq('household_id', m.householdId)
  if (error) { console.error('deleteAssetTransaction:', error.message); return { ok: false } }
  revalidatePath(`/assets/${input.assetId}`); revalidatePath('/assets'); revalidatePath('/')
  return { ok: true }
}

export async function deleteAsset(input: { id: string }): Promise<{ ok: boolean }> {
  const m = await getMembership()
  if (!m) return { ok: false }
  const supabase = await createClient()
  // asset_transactions.asset_id and monthly_commitments.asset_id are ON DELETE CASCADE,
  // so removing the asset removes its transactions and commitments automatically.
  const { error } = await supabase.from('assets')
    .delete().eq('id', input.id).eq('household_id', m.householdId)
  if (error) { console.error('deleteAsset:', error.message); return { ok: false } }
  revalidatePath('/assets'); revalidatePath('/')
  return { ok: true }
}
