// Pure, server/client-safe triage helpers and types — no supabase / next/headers here.
// Kept separate from expenses.ts so client components and vitest can use these without
// pulling server-only modules into the bundle.
import { isCategoryKey } from '@/lib/categories'
import type { ExpenseRow, Member } from './types'

export type TriageInput = { category: string | null; paidBy: Member | null }

// A row needs triage while it is missing a category and/or a payer.
export function needsTriage(row: Pick<ExpenseRow, 'category' | 'paid_by'>): boolean {
  return row.category == null || row.paid_by == null
}

export function countNeedingTriage(rows: Pick<ExpenseRow, 'category' | 'paid_by'>[]): number {
  return rows.reduce((n, r) => (needsTriage(r) ? n + 1 : n), 0)
}

// Triage resolves BOTH fields at once, so both must be present and valid.
export function validateTriageInput(input: TriageInput): { ok: true } | { ok: false; error: string } {
  if (input.category == null || !isCategoryKey(input.category)) return { ok: false, error: 'invalid_category' }
  if (input.paidBy !== 'CH' && input.paidBy !== 'JC') return { ok: false, error: 'invalid_member' }
  return { ok: true }
}
