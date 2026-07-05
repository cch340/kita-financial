'use server'
import { revalidatePath } from 'next/cache'
import {
  createCategory, renameCategory, deleteCategory, countExpensesUsingCategory,
} from '@/lib/data/categories'
import {
  createVendor, renameVendor, deleteVendor, countExpensesUsingVendor,
} from '@/lib/data/vendors'
import {
  createLocation, renameLocation, deleteLocation, countExpensesUsingLocation,
} from '@/lib/data/locations'

export type CatalogKind = 'category' | 'vendor' | 'location'

type Result = { ok: true; id?: string } | { ok: false; error: string }

function revalidate() {
  revalidatePath('/manage'); revalidatePath('/expenses')
  revalidatePath('/expenses/add'); revalidatePath('/')
}

export async function createItemAction(kind: CatalogKind, name: string): Promise<Result> {
  const fn = kind === 'category' ? createCategory : kind === 'vendor' ? createVendor : createLocation
  const res = await fn(name)
  if (res.ok) revalidate()
  return res.ok ? { ok: true, id: res.id } : { ok: false, error: res.error }
}

export async function renameItemAction(kind: CatalogKind, id: string, name: string): Promise<Result> {
  const fn = kind === 'category' ? renameCategory : kind === 'vendor' ? renameVendor : renameLocation
  const res = await fn(id, name)
  if (res.ok) revalidate()
  return res.ok ? { ok: true } : { ok: false, error: res.error }
}

export async function deleteItemAction(kind: CatalogKind, id: string): Promise<{ ok: boolean }> {
  const fn = kind === 'category' ? deleteCategory : kind === 'vendor' ? deleteVendor : deleteLocation
  const res = await fn(id)
  if (res.ok) revalidate()
  return res
}

export async function countUsageAction(kind: CatalogKind, id: string): Promise<number> {
  const fn = kind === 'category' ? countExpensesUsingCategory
    : kind === 'vendor' ? countExpensesUsingVendor : countExpensesUsingLocation
  return fn(id)
}
