'use server'
import { addExpense } from '@/lib/data/expenses'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function addExpenseAction(formData: FormData) {
  const amountCents = Number(formData.get('amountCents'))
  const category = (formData.get('category') as string) || null
  const paidByRaw = (formData.get('paidBy') as string) || ''
  const paidBy = paidByRaw === 'CH' || paidByRaw === 'JC' ? paidByRaw : null
  const note = (formData.get('note') as string) || null
  const dateISO = (formData.get('dateISO') as string) || new Date().toISOString().slice(0, 10)
  const res = await addExpense({ amountCents, category, paidBy, note, dateISO })
  if (!res.ok) redirect('/expenses/add?error=' + encodeURIComponent(res.error))
  revalidatePath('/expenses'); revalidatePath('/')
  redirect('/expenses')
}
