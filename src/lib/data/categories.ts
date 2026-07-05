import { createClient } from '@/lib/supabase/server'
import { getMembership } from './household'
import {
  normalizeName, findCaseInsensitiveDuplicate, nextSortOrder, type CatalogItem,
} from './catalog-shared'

const TABLE = 'expense_categories'
const EXPENSE_FK = 'category_id'

export async function listCategories(): Promise<CatalogItem[]> {
  const m = await getMembership()
  if (!m) return []
  const supabase = await createClient()
  const { data, error } = await supabase.from(TABLE)
    .select('id, name, sort_order').eq('household_id', m.householdId)
    .order('sort_order', { ascending: true })
  if (error) { console.error('listCategories failed:', error.message); return [] }
  return (data ?? []) as CatalogItem[]
}

export async function createCategory(
  name: string,
): Promise<{ ok: true; id: string } | { ok: false; error: 'duplicate' | 'invalid' | 'save_failed' }> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'save_failed' }
  const clean = normalizeName(name)
  if (!clean) return { ok: false, error: 'invalid' }
  const existing = await listCategories()
  if (findCaseInsensitiveDuplicate(clean, existing)) return { ok: false, error: 'duplicate' }
  const supabase = await createClient()
  const { data, error } = await supabase.from(TABLE)
    .insert({ household_id: m.householdId, name: clean, sort_order: nextSortOrder(existing) })
    .select('id').single()
  if (error || !data) {
    if (error?.code === '23505') return { ok: false, error: 'duplicate' } // unique index race
    console.error('createCategory failed:', error?.message)
    return { ok: false, error: 'save_failed' }
  }
  return { ok: true, id: data.id as string }
}

export async function renameCategory(
  id: string, name: string,
): Promise<{ ok: true } | { ok: false; error: 'duplicate' | 'invalid' | 'save_failed' }> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'save_failed' }
  const clean = normalizeName(name)
  if (!clean) return { ok: false, error: 'invalid' }
  const existing = await listCategories()
  if (findCaseInsensitiveDuplicate(clean, existing, id)) return { ok: false, error: 'duplicate' }
  const supabase = await createClient()
  const { error } = await supabase.from(TABLE)
    .update({ name: clean }).eq('id', id).eq('household_id', m.householdId)
  if (error) {
    if (error.code === '23505') return { ok: false, error: 'duplicate' }
    console.error('renameCategory failed:', error.message)
    return { ok: false, error: 'save_failed' }
  }
  return { ok: true }
}

export async function deleteCategory(id: string): Promise<{ ok: boolean }> {
  const m = await getMembership()
  if (!m) return { ok: false }
  const supabase = await createClient()
  const { error } = await supabase.from(TABLE).delete().eq('id', id).eq('household_id', m.householdId)
  if (error) { console.error('deleteCategory failed:', error.message); return { ok: false } }
  return { ok: true }
}

export async function countExpensesUsingCategory(id: string): Promise<number> {
  const m = await getMembership()
  if (!m) return 0
  const supabase = await createClient()
  const { count, error } = await supabase.from('expenses')
    .select('id', { count: 'exact', head: true })
    .eq('household_id', m.householdId).eq(EXPENSE_FK, id)
  if (error) { console.error('countExpensesUsingCategory failed:', error.message); return 0 }
  return count ?? 0
}
