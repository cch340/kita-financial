// Pure, server/client-safe personal-ledger helpers and types — no supabase import here.
// Kept separate from personal.ts so client components (PersonalView) can import these
// without pulling in `next/headers` (via createClient) through getPersonalLedger/getPersonalBalances.
export type LedgerEntry = {
  id: string
  ownerMemberCode: 'CH' | 'JC'
  period: string
  entryType: 'income' | 'expense'
  description: string
  amountCents: number
  remark: string | null
}

export const sumByType = (entries: LedgerEntry[], type: 'income' | 'expense') =>
  entries.filter((e) => e.entryType === type).reduce((a, e) => a + e.amountCents, 0)

export const balanceCents = (entries: LedgerEntry[]) => sumByType(entries, 'income') - sumByType(entries, 'expense')

export type LedgerInput = {
  entryType: 'income' | 'expense'
  description: string
  amountCents: number
}

export function validateLedgerInput(input: LedgerInput): { ok: true } | { ok: false; error: string } {
  if (input.entryType !== 'income' && input.entryType !== 'expense') return { ok: false, error: 'invalid_type' }
  if (!input.description.trim()) return { ok: false, error: 'invalid_description' }
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) return { ok: false, error: 'invalid_amount' }
  return { ok: true }
}

/**
 * Given the member's months with data (period-date ISO strings, e.g. "2026-06-01")
 * and the target month's period, return the most recent month strictly earlier than
 * the target to clone from, or null when there is nothing earlier. Input order is not
 * assumed. ISO date strings are lexicographically comparable, so string `<` is correct.
 */
export function pickCopySourceMonth(availableMonths: string[], targetPeriod: string): string | null {
  const earlier = availableMonths.filter((p) => p < targetPeriod)
  if (earlier.length === 0) return null
  return earlier.reduce((a, b) => (a > b ? a : b))
}
