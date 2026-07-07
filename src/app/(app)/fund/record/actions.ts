'use server'
import { createFundRecord, updateFundRecord } from '@/lib/data/fund'
import { periodISOForMonth } from '@/lib/data/fund-shared'
import type { Member } from '@/lib/data/types'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

function parse(formData: FormData) {
  const memberCode = String(formData.get('memberCode') ?? '') as Member
  const year = Number(formData.get('year'))
  const month = Number(formData.get('month'))
  const amountCents = Number(formData.get('amountCents'))
  const notesRaw = String(formData.get('notes') ?? '').trim()
  return { memberCode, periodISO: periodISOForMonth(year, month), amountCents, notes: notesRaw || null }
}

export async function addFundRecordAction(formData: FormData) {
  const res = await createFundRecord(parse(formData))
  if (!res.ok) redirect('/fund/record/add?error=' + encodeURIComponent(res.error ?? 'save_failed'))
  revalidatePath('/fund'); revalidatePath('/')
  redirect('/fund')
}

export async function updateFundRecordAction(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  if (!id) redirect('/fund')
  const res = await updateFundRecord(id, parse(formData))
  if (!res.ok) redirect(`/fund/record/edit/${id}?error=` + encodeURIComponent(res.error ?? 'save_failed'))
  revalidatePath('/fund'); revalidatePath('/')
  redirect('/fund')
}
