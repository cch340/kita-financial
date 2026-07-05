// Pure, server/client-safe expense helpers and types — no supabase import here.
export type Member = 'CH' | 'JC'

export type ExpenseInput = {
  dateISO: string
  categoryId: string | null
  vendorId: string | null
  locationId: string | null
  paidBy: Member | null
  amountCents: number
  note: string | null
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function validateExpenseInput(input: ExpenseInput): { ok: true } | { ok: false; error: string } {
  if (!DATE_RE.test(input.dateISO)) return { ok: false, error: 'invalid_date' }
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) return { ok: false, error: 'invalid_amount' }
  if (input.paidBy != null && input.paidBy !== 'CH' && input.paidBy !== 'JC') return { ok: false, error: 'invalid_member' }
  return { ok: true }
}

export function parseExpenseForm(fd: FormData): ExpenseInput {
  const strOrNull = (key: string): string | null => {
    const v = fd.get(key)
    const s = typeof v === 'string' ? v.trim() : ''
    return s ? s : null
  }
  const paidByRaw = typeof fd.get('paidBy') === 'string' ? (fd.get('paidBy') as string) : ''
  return {
    dateISO: typeof fd.get('dateISO') === 'string' ? (fd.get('dateISO') as string) : '',
    categoryId: strOrNull('categoryId'),
    vendorId: strOrNull('vendorId'),
    locationId: strOrNull('locationId'),
    paidBy: paidByRaw === 'CH' || paidByRaw === 'JC' ? paidByRaw : null,
    amountCents: Number(fd.get('amountCents')),
    note: strOrNull('note'),
  }
}
