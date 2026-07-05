'use server'
import { createClient } from '@/lib/supabase/server'
import { getMembership } from '@/lib/data/household'
import { revalidatePath } from 'next/cache'

type Res = { ok: boolean; error?: string }

function revalidateBudget() {
  revalidatePath('/budget'); revalidatePath('/budget/manage'); revalidatePath('/')
}

export async function createCategory(input: { nameEn: string; nameZh: string | null; jcCents: number; chCents: number }): Promise<Res> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }
  if (!input.nameEn.trim()) return { ok: false, error: 'invalid_name' }
  const supabase = await createClient()
  const { data: maxRow } = await supabase.from('budget_categories')
    .select('sort_order').eq('household_id', m.householdId).order('sort_order', { ascending: false }).limit(1).maybeSingle()
  const nextOrder = (maxRow?.sort_order ?? 0) + 1
  const { error } = await supabase.from('budget_categories').insert({
    household_id: m.householdId, name_en: input.nameEn.trim(), name_zh: input.nameZh?.trim() || null,
    jc_cents: input.jcCents, ch_cents: input.chCents, total_cents: input.jcCents + input.chCents, sort_order: nextOrder,
  })
  if (error) { console.error('createCategory:', error.message); return { ok: false, error: 'save_failed' } }
  revalidateBudget()
  return { ok: true }
}

export async function updateCategory(input: { id: string; nameEn: string; nameZh: string | null; jcCents: number; chCents: number }): Promise<Res> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }
  if (!input.nameEn.trim()) return { ok: false, error: 'invalid_name' }
  const supabase = await createClient()
  const { error } = await supabase.from('budget_categories').update({
    name_en: input.nameEn.trim(), name_zh: input.nameZh?.trim() || null,
    jc_cents: input.jcCents, ch_cents: input.chCents, total_cents: input.jcCents + input.chCents,
  }).eq('id', input.id).eq('household_id', m.householdId)
  if (error) { console.error('updateCategory:', error.message); return { ok: false, error: 'save_failed' } }
  revalidateBudget()
  return { ok: true }
}

export async function deleteCategory(id: string): Promise<Res> {
  const m = await getMembership()
  if (!m) return { ok: false }
  const supabase = await createClient()
  const { error } = await supabase.from('budget_categories').delete().eq('id', id).eq('household_id', m.householdId)
  if (error) { console.error('deleteCategory:', error.message); return { ok: false, error: 'save_failed' } }
  revalidateBudget()
  return { ok: true }
}

export async function reorderCategories(orderedIds: string[]): Promise<Res> {
  const m = await getMembership()
  if (!m) return { ok: false }
  const supabase = await createClient()
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase.from('budget_categories')
      .update({ sort_order: i + 1 }).eq('id', orderedIds[i]).eq('household_id', m.householdId)
    if (error) { console.error('reorderCategories:', error.message); return { ok: false, error: 'save_failed' } }
  }
  revalidateBudget()
  return { ok: true }
}

export async function createCommitment(input: { nameEn: string; nameZh: string | null; amountCents: number }): Promise<Res> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }
  if (!input.nameEn.trim()) return { ok: false, error: 'invalid_name' }
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) return { ok: false, error: 'invalid_amount' }
  const supabase = await createClient()
  const { data: maxRow } = await supabase.from('monthly_commitments')
    .select('sort_order').eq('household_id', m.householdId).order('sort_order', { ascending: false }).limit(1).maybeSingle()
  const nextOrder = (maxRow?.sort_order ?? 0) + 1
  const { error } = await supabase.from('monthly_commitments').insert({
    household_id: m.householdId, name_en: input.nameEn.trim(), name_zh: input.nameZh?.trim() || null,
    amount_cents: input.amountCents, sort_order: nextOrder,
  })
  if (error) { console.error('createCommitment:', error.message); return { ok: false, error: 'save_failed' } }
  revalidateBudget()
  return { ok: true }
}

export async function updateCommitment(input: { id: string; nameEn: string; nameZh: string | null; amountCents: number }): Promise<Res> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }
  if (!input.nameEn.trim()) return { ok: false, error: 'invalid_name' }
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) return { ok: false, error: 'invalid_amount' }
  const supabase = await createClient()
  const { error } = await supabase.from('monthly_commitments').update({
    name_en: input.nameEn.trim(), name_zh: input.nameZh?.trim() || null, amount_cents: input.amountCents,
  }).eq('id', input.id).eq('household_id', m.householdId)
  if (error) { console.error('updateCommitment:', error.message); return { ok: false, error: 'save_failed' } }
  revalidateBudget()
  return { ok: true }
}

export async function deleteCommitment(id: string): Promise<Res> {
  const m = await getMembership()
  if (!m) return { ok: false }
  const supabase = await createClient()
  const { error } = await supabase.from('monthly_commitments').delete().eq('id', id).eq('household_id', m.householdId)
  if (error) { console.error('deleteCommitment:', error.message); return { ok: false, error: 'save_failed' } }
  revalidateBudget()
  return { ok: true }
}

export async function reorderCommitments(orderedIds: string[]): Promise<Res> {
  const m = await getMembership()
  if (!m) return { ok: false }
  const supabase = await createClient()
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase.from('monthly_commitments')
      .update({ sort_order: i + 1 }).eq('id', orderedIds[i]).eq('household_id', m.householdId)
    if (error) { console.error('reorderCommitments:', error.message); return { ok: false, error: 'save_failed' } }
  }
  revalidateBudget()
  return { ok: true }
}
