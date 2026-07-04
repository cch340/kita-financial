'use server'
import { createClient } from '@/lib/supabase/server'
import { getMembership } from '@/lib/data/household'
import { revalidatePath } from 'next/cache'
import type { AssetType } from '@/lib/data/assets-shared'

export async function createAsset(input: {
  type: AssetType; name: string; ownerMemberCode?: 'CH' | 'JC' | null
  openingBalanceCents?: number | null; metadata?: Record<string, unknown>
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }
  if (!input.name.trim()) return { ok: false, error: 'invalid_name' }
  const supabase = await createClient()
  const { data, error } = await supabase.from('assets').insert({
    household_id: m.householdId, type: input.type, name: input.name.trim(),
    owner_member_code: input.ownerMemberCode ?? null,
    opening_balance_cents: input.openingBalanceCents ?? null, metadata: input.metadata ?? {},
  }).select('id').single()
  if (error || !data) { console.error('createAsset:', error?.message); return { ok: false, error: 'save_failed' } }
  revalidatePath('/assets')
  return { ok: true, id: data.id }
}
