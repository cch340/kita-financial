// Pure, server/client-safe triage helpers and types — no supabase / next/headers here.
// Kept separate from expenses.ts so client components and vitest can use these without
// pulling server-only modules into the bundle.
import type { ExpenseRow, Member } from './types'

export type TriageInput = { categoryId: string | null; paidBy: Member | null }

// A row needs triage while it is missing a category and/or a payer.
export function needsTriage(row: Pick<ExpenseRow, 'category_id' | 'paid_by'>): boolean {
  return row.category_id == null || row.paid_by == null
}

export function countNeedingTriage(rows: Pick<ExpenseRow, 'category_id' | 'paid_by'>[]): number {
  return rows.reduce((n, r) => (needsTriage(r) ? n + 1 : n), 0)
}

// Triage resolves BOTH fields at once. Category existence is enforced by the FK on write.
export function validateTriageInput(input: TriageInput): { ok: true } | { ok: false; error: string } {
  if (input.categoryId == null || input.categoryId.trim() === '') return { ok: false, error: 'invalid_category' }
  if (input.paidBy !== 'CH' && input.paidBy !== 'JC') return { ok: false, error: 'invalid_member' }
  return { ok: true }
}
