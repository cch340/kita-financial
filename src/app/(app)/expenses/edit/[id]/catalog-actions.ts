'use server'
import { revalidatePath } from 'next/cache'
import { createVendor } from '@/lib/data/vendors'
import { createLocation } from '@/lib/data/locations'

export async function createVendorAction(
  name: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const res = await createVendor(name)
  if (res.ok) { revalidatePath('/expenses'); return { ok: true, id: res.id } }
  return { ok: false, error: res.error }
}

export async function createLocationAction(
  name: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const res = await createLocation(name)
  if (res.ok) { revalidatePath('/expenses'); return { ok: true, id: res.id } }
  return { ok: false, error: res.error }
}
