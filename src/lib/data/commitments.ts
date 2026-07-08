// src/lib/data/commitments.ts
import { createClient } from '@/lib/supabase/server'
import { getMembership } from './household'
import type { Commitment, CommitmentRow } from './commitments-shared'

export { moveItem } from './commitments-shared'
export type { Commitment, CommitmentRow } from './commitments-shared'

export async function getCommitments(assetId: string): Promise<Commitment[]> {
  const m = await getMembership()
  if (!m) return []
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('monthly_commitments')
    .select('name, amount_cents, remark, sort_order')
    .eq('household_id', m.householdId)
    .eq('asset_id', assetId)
    .order('sort_order', { ascending: true })
  if (error) { console.error('getCommitments:', error.message); return [] }
  return ((data ?? []) as { name: string; amount_cents: number; remark: string | null }[])
    .map((c) => ({ name: c.name, amountCents: c.amount_cents, remark: c.remark }))
}

export async function getCommitmentsRaw(assetId: string): Promise<CommitmentRow[]> {
  const m = await getMembership()
  if (!m) return []
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('monthly_commitments')
    .select('id, name, amount_cents, remark, sort_order')
    .eq('household_id', m.householdId)
    .eq('asset_id', assetId)
    .order('sort_order', { ascending: true })
  if (error) { console.error('getCommitmentsRaw:', error.message); return [] }
  return ((data ?? []) as { id: string; name: string; amount_cents: number; remark: string | null; sort_order: number }[])
    .map((c) => ({ id: c.id, name: c.name, amountCents: c.amount_cents, remark: c.remark, sortOrder: c.sort_order }))
}
