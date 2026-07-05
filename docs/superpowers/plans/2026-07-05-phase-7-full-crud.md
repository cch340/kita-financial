# Phase 7 — Full CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every Excel-editable concept editable in-app — edit/add full expenses, edit/delete personal-ledger entries and asset transactions, manage budget categories & monthly commitments, edit joint-fund config, and close/reopen/edit assets — so the household never has to open the spreadsheet.

**Architecture:** Follow the existing data-layer split: pure, framework-free validation/transform helpers live in `<domain>-shared.ts` (unit-tested with vitest), server reads/writes live in `<domain>.ts` or in `'use server'` `actions.ts` files that scope every query to `getMembership().householdId`. Mutations `revalidatePath(...)` the affected screens; form-submit mutations `redirect(...)` back with `?error=` on failure, direct-call (client-invoked) mutations return `{ ok, error? }`. All money stays integer cents (`parseMoneyInput` in, `formatRM`/`MoneyText` out). Every new user-facing string gets an `en` and `zh` dictionary entry.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript · Supabase (anon client, RLS) · Tailwind 4 · vitest + jsdom · lucide-react.

## Global Constraints

- **Money is always integer cents** (`bigint` in Postgres, `number` in TS). Parse user text with `parseMoneyInput` (`src/lib/money.ts`); never store or compare floats. Display only via `formatRM` / `<MoneyText cents={...} />`.
- **Household scoping is mandatory.** Every read/write goes through the anon client (`createClient` from `@/lib/supabase/server`) and filters `.eq('household_id', m.householdId)` where `m = await getMembership()`. Never use the admin client here.
- **Members are the fixed enum** `'CH' | 'JC'`. Expense categories are the fixed enum in `src/lib/categories.ts` (`CategoryKey`) — **do NOT link expense categories to budget categories**; they stay independent.
- **Pure logic goes in `-shared.ts`** (no `next/headers`, no supabase import) so client components can import it and vitest can test it. Tests are colocated `*.test.ts`, run with `npx vitest run <file>`.
- **i18n:** add every new key to both `en` and `zh` in `src/i18n/dictionaries.ts`. Client components read via `useT()`/`useLocale()`; server components via `t(locale, key)`.
- **Server-action conventions:** form-submit actions parse `FormData`, then `revalidatePath` + `redirect('/screen')` on success or `redirect('/screen?error=<key>')` on failure. Client-invoked actions return `{ ok: boolean; error?: string }` and `revalidatePath` on success.
- **UI primitives:** reuse `Card`/`HeroCard` (`@/components/ui/Card`), `MoneyText`, `Spinner`, `SubmitButton`, `MemberAvatar`, `IconTile`. Buttons are `min-h-[44px]`, use `pressable`/`pressable-opacity`, and CSS custom-property colors (`var(--primary)`, `var(--surface)`, `var(--hairline)`, `var(--danger)`, etc.).
- **No new npm dependencies.**

## Schema note (one manual migration required)

Phase 7 needs **no schema changes except one**: `monthly_commitments` has no `sort_order` column, but the spec requires reordering commitments. Task 6 includes a SQL snippet the user must paste into the Supabase SQL editor (this repo has no local migration tooling — see CLAUDE.md). All other columns Phase 7 touches (`expenses.vendor/location/category/paid_by/date`, `ledger_entries.*`, `asset_transactions.*`, `budget_categories.*`, `joint_fund_config.*`, `assets.status/name/metadata`) already exist in `supabase/migrations/0001_schema.sql`.

---

## File Structure

- `src/lib/data/expenses-shared.ts` **(new)** — `ExpenseInput` type, pure `validateExpenseInput`, pure `parseExpenseForm(FormData)`.
- `src/lib/data/expenses.ts` — add `location`; `addExpense(ExpenseInput)`, `getExpense`, `updateExpense`.
- `src/lib/data/types.ts` — add `location` to `ExpenseRow`.
- `src/app/(app)/expenses/add/actions.ts` — use `parseExpenseForm`.
- `src/app/(app)/expenses/add/AddExpenseForm.tsx` — date picker + collapsible vendor/location.
- `src/app/(app)/expenses/actions.ts` — add `updateExpenseAction`.
- `src/app/(app)/expenses/edit/[id]/{page.tsx,EditExpenseForm.tsx}` **(new)** — edit sheet.
- `src/app/(app)/expenses/ExpensesView.tsx` — wire the swipe **Edit** button to the edit route.
- `src/lib/data/personal-shared.ts` — add `LedgerInput`, `validateLedgerInput`.
- `src/app/(app)/personal/actions.ts` — add `updateLedgerEntry`, `deleteLedgerEntry`.
- `src/app/(app)/personal/PersonalView.tsx` — editable/deletable ledger rows.
- `src/lib/data/assets-shared.ts` — add `TxnInput`, `validateTxnInput`, `splitByStatus`.
- `src/app/(app)/assets/actions.ts` — add `updateAssetTransaction`, `deleteAssetTransaction`, `updateAsset`, `setAssetStatus`.
- `src/app/(app)/assets/[id]/txn/[txnId]/{page.tsx,EditTxnForm.tsx}` **(new)** — asset-txn edit/delete sheet.
- `src/app/(app)/assets/[id]/{PropertyBody,VehicleBody,InvestmentBody}.tsx` + `[id]/page.tsx` — per-row Edit link; header close/reopen + edit-asset link.
- `src/app/(app)/assets/[id]/edit/{page.tsx,EditAssetForm.tsx}` **(new)** — edit asset name/metadata.
- `src/app/(app)/assets/page.tsx` — closed assets shown dimmed in a collapsed section.
- `src/lib/data/budget.ts` — raw category/commitment reads (with ids), order commitments by `sort_order`.
- `src/lib/data/budget-shared.ts` **(new)** — `moveItem` reorder helper + input validators.
- `src/app/(app)/budget/actions.ts` **(new)** — category/commitment CRUD + reorder actions.
- `src/app/(app)/budget/manage/{page.tsx,BudgetManager.tsx}` **(new)** — manage screen.
- `src/app/(app)/budget/page.tsx` — header link to `/budget/manage`.
- `src/lib/data/fund.ts` — add `getFundConfig`.
- `src/app/(app)/fund/actions.ts` — add `updateFundConfig`.
- `src/app/(app)/fund/{page.tsx,FundView.tsx,FundConfigEditor.tsx (new)}` — config editor sheet.
- `src/i18n/dictionaries.ts` — new keys (both languages), listed per task.

---

## Task 1: Expenses data layer — shared validation, `location`, get & update

**Files:**
- Create: `src/lib/data/expenses-shared.ts`
- Create: `src/lib/data/expenses-shared.test.ts`
- Modify: `src/lib/data/types.ts` (ExpenseRow)
- Modify: `src/lib/data/expenses.ts`
- Modify: `src/i18n/dictionaries.ts` (add `error.invalid_date`)

**Interfaces:**
- Produces:
  - `type Member = 'CH' | 'JC'`
  - `type ExpenseInput = { dateISO: string; vendor: string | null; location: string | null; category: string | null; paidBy: Member | null; amountCents: number; note: string | null }`
  - `validateExpenseInput(input: ExpenseInput): { ok: true } | { ok: false; error: string }`
  - `parseExpenseForm(fd: FormData): ExpenseInput`
  - `addExpense(input: ExpenseInput): Promise<{ ok: true } | { ok: false; error: string }>`
  - `getExpense(id: string): Promise<ExpenseRow | null>`
  - `updateExpense(id: string, input: ExpenseInput): Promise<{ ok: true } | { ok: false; error: string }>`
  - `ExpenseRow` now includes `location: string | null`

- [ ] **Step 1: Write the failing test**

Create `src/lib/data/expenses-shared.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { validateExpenseInput, parseExpenseForm, type ExpenseInput } from './expenses-shared'

const base: ExpenseInput = {
  dateISO: '2026-07-05', vendor: null, location: null, category: 'food',
  paidBy: 'CH', amountCents: 4250, note: null,
}

describe('validateExpenseInput', () => {
  it('accepts a well-formed input', () => {
    expect(validateExpenseInput(base)).toEqual({ ok: true })
  })
  it('rejects a bad date', () => {
    expect(validateExpenseInput({ ...base, dateISO: '5 July' })).toEqual({ ok: false, error: 'invalid_date' })
    expect(validateExpenseInput({ ...base, dateISO: '' })).toEqual({ ok: false, error: 'invalid_date' })
  })
  it('rejects non-positive or non-integer amounts', () => {
    expect(validateExpenseInput({ ...base, amountCents: 0 })).toEqual({ ok: false, error: 'invalid_amount' })
    expect(validateExpenseInput({ ...base, amountCents: -5 })).toEqual({ ok: false, error: 'invalid_amount' })
    expect(validateExpenseInput({ ...base, amountCents: 1.5 })).toEqual({ ok: false, error: 'invalid_amount' })
  })
  it('rejects an invalid payer but allows null', () => {
    expect(validateExpenseInput({ ...base, paidBy: 'ZZ' as unknown as 'CH' })).toEqual({ ok: false, error: 'invalid_member' })
    expect(validateExpenseInput({ ...base, paidBy: null })).toEqual({ ok: true })
  })
})

describe('parseExpenseForm', () => {
  it('reads fields, trims strings, and empties to null', () => {
    const fd = new FormData()
    fd.set('dateISO', '2026-07-05')
    fd.set('vendor', '  Aeon  ')
    fd.set('location', '')
    fd.set('category', 'groceries')
    fd.set('paidBy', 'JC')
    fd.set('amountCents', '4250')
    fd.set('note', '  weekly  ')
    expect(parseExpenseForm(fd)).toEqual({
      dateISO: '2026-07-05', vendor: 'Aeon', location: null, category: 'groceries',
      paidBy: 'JC', amountCents: 4250, note: 'weekly',
    })
  })
  it('coerces an unknown payer to null and category empty to null', () => {
    const fd = new FormData()
    fd.set('dateISO', '2026-07-05')
    fd.set('paidBy', 'XX')
    fd.set('category', '')
    fd.set('amountCents', '100')
    const out = parseExpenseForm(fd)
    expect(out.paidBy).toBeNull()
    expect(out.category).toBeNull()
    expect(out.amountCents).toBe(100)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/data/expenses-shared.test.ts`
Expected: FAIL — cannot resolve `./expenses-shared`.

- [ ] **Step 3: Create the shared module**

Create `src/lib/data/expenses-shared.ts`:

```ts
// Pure, server/client-safe expense helpers and types — no supabase import here.
// Kept separate from expenses.ts so client components and vitest can use these
// without pulling in `next/headers` (via createClient) through the data reads.
export type Member = 'CH' | 'JC'

export type ExpenseInput = {
  dateISO: string
  vendor: string | null
  location: string | null
  category: string | null
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
  const trimmed = (key: string): string | null => {
    const v = fd.get(key)
    const s = typeof v === 'string' ? v.trim() : ''
    return s ? s : null
  }
  const paidByRaw = typeof fd.get('paidBy') === 'string' ? (fd.get('paidBy') as string) : ''
  return {
    dateISO: typeof fd.get('dateISO') === 'string' ? (fd.get('dateISO') as string) : '',
    vendor: trimmed('vendor'),
    location: trimmed('location'),
    category: trimmed('category'),
    paidBy: paidByRaw === 'CH' || paidByRaw === 'JC' ? paidByRaw : null,
    amountCents: Number(fd.get('amountCents')),
    note: trimmed('note'),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/data/expenses-shared.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Add `location` to `ExpenseRow`**

In `src/lib/data/types.ts`, change the `ExpenseRow` type to include `location`:

```ts
export type ExpenseRow = {
  id: string
  date: string
  vendor: string | null
  location: string | null
  details: string | null
  category: string | null
  amount_cents: number
  paid_by: Member | null
}
```

- [ ] **Step 6: Rewrite `expenses.ts` to use the shared input, add location column, `getExpense`, `updateExpense`**

Replace the top of `src/lib/data/expenses.ts` (imports + `COLS`) and the `addExpense` function, and append `getExpense`/`updateExpense`. Final file:

```ts
import { createClient } from '@/lib/supabase/server'
import { getMembership } from './household'
import { monthRange } from './summary'
import type { ExpenseRow } from './types'
import { validateExpenseInput, type ExpenseInput } from './expenses-shared'

// Re-exported for convenience; client components should import from './expenses-shared'.
export { validateExpenseInput }
export type { ExpenseInput }

const COLS = 'id, date, vendor, location, details, category, amount_cents, paid_by'

export async function listExpenses(opts?: { year?: number; month?: number }): Promise<ExpenseRow[]> {
  const m = await getMembership()
  if (!m) return []
  const supabase = await createClient()
  let q = supabase.from('expenses').select(COLS).eq('household_id', m.householdId).order('date', { ascending: false })
  if (opts?.year && opts?.month) {
    const { startISO, endISO } = monthRange(opts.year, opts.month)
    q = q.gte('date', startISO).lt('date', endISO)
  }
  const { data, error } = await q
  if (error) { console.error('listExpenses failed:', error.message); return [] }
  return (data ?? []) as ExpenseRow[]
}

export async function getMonthTotalCents(year: number, month: number): Promise<number> {
  const rows = await listExpenses({ year, month })
  return rows.reduce((a, r) => a + r.amount_cents, 0)
}

export async function getExpense(id: string): Promise<ExpenseRow | null> {
  const m = await getMembership()
  if (!m) return null
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('expenses').select(COLS).eq('id', id).eq('household_id', m.householdId).single()
  if (error || !data) {
    if (error && error.code !== 'PGRST116') console.error('getExpense failed:', error.message)
    return null
  }
  return data as ExpenseRow
}

export async function addExpense(input: ExpenseInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }
  const valid = validateExpenseInput(input)
  if (!valid.ok) return valid
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase.from('expenses').insert({
    household_id: m.householdId,
    date: input.dateISO,
    vendor: input.vendor,
    location: input.location,
    details: input.note,
    category: input.category,
    amount_cents: input.amountCents,
    paid_by: input.paidBy,
    created_by: user?.id ?? null,
  })
  if (error) { console.error('addExpense failed:', error.message); return { ok: false, error: 'save_failed' } }
  return { ok: true }
}

export async function updateExpense(id: string, input: ExpenseInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }
  const valid = validateExpenseInput(input)
  if (!valid.ok) return valid
  const supabase = await createClient()
  const { error } = await supabase.from('expenses').update({
    date: input.dateISO,
    vendor: input.vendor,
    location: input.location,
    details: input.note,
    category: input.category,
    amount_cents: input.amountCents,
    paid_by: input.paidBy,
  }).eq('id', id).eq('household_id', m.householdId)
  if (error) { console.error('updateExpense failed:', error.message); return { ok: false, error: 'save_failed' } }
  return { ok: true }
}

export async function deleteExpense(id: string): Promise<{ ok: boolean; error?: string }> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'Not authenticated' }
  const supabase = await createClient()
  const { error } = await supabase.from('expenses').delete().eq('id', id).eq('household_id', m.householdId)
  if (error) { console.error('deleteExpense failed:', error.message); return { ok: false, error: error.message } }
  return { ok: true }
}
```

- [ ] **Step 7: Add the `error.invalid_date` dictionary key (both languages)**

In `src/i18n/dictionaries.ts`, add to the `en` block (next to `error.invalid_amount`):

```ts
    'error.invalid_date': 'Enter a valid date',
```

and to the `zh` block:

```ts
    'error.invalid_date': '请输入有效日期',
```

- [ ] **Step 8: Run the full suite and typecheck**

Run: `npx vitest run src/lib/data/expenses-shared.test.ts && npm run lint`
Expected: tests PASS; lint clean (no unused imports; `deleteExpense` unchanged).

- [ ] **Step 9: Commit**

```bash
git add src/lib/data/expenses-shared.ts src/lib/data/expenses-shared.test.ts src/lib/data/expenses.ts src/lib/data/types.ts src/i18n/dictionaries.ts
git commit -m "feat(expenses): shared expense-input validation, location column, get/update data fns"
```

---

## Task 2: Add-expense form — date picker + collapsible vendor/location

**Files:**
- Modify: `src/app/(app)/expenses/add/actions.ts`
- Modify: `src/app/(app)/expenses/add/AddExpenseForm.tsx`
- Modify: `src/i18n/dictionaries.ts` (add `add.more`, `add.vendor`, `add.location`, `add.date`)

**Interfaces:**
- Consumes: `parseExpenseForm` (Task 1), `addExpense(ExpenseInput)` (Task 1).
- Produces: `addExpenseAction(formData: FormData)` unchanged name/signature; form now posts `dateISO`, `vendor`, `location`.

- [ ] **Step 1: Simplify `addExpenseAction` to use `parseExpenseForm`**

Replace `src/app/(app)/expenses/add/actions.ts` entirely:

```ts
'use server'
import { addExpense } from '@/lib/data/expenses'
import { parseExpenseForm } from '@/lib/data/expenses-shared'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function addExpenseAction(formData: FormData) {
  const res = await addExpense(parseExpenseForm(formData))
  if (!res.ok) redirect('/expenses/add?error=' + encodeURIComponent(res.error))
  revalidatePath('/expenses'); revalidatePath('/')
  redirect('/expenses')
}
```

- [ ] **Step 2: Add date + vendor + location state and the collapsible "More" section to `AddExpenseForm`**

In `src/app/(app)/expenses/add/AddExpenseForm.tsx`:

1. Add state (after the existing `const [note, setNote] = useState('')`):

```tsx
  const [vendor, setVendor] = useState('')
  const [location, setLocation] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [showMore, setShowMore] = useState(false)
```

2. Delete the now-unused `const todayISO = new Date().toISOString().slice(0, 10)` line.

3. Replace the hidden-inputs block so date/vendor/location post with the form:

```tsx
          <input type="hidden" name="amountCents" value={cents} />
          <input type="hidden" name="category" value={category ?? ''} />
          <input type="hidden" name="paidBy" value={payer ?? ''} />
          <input type="hidden" name="note" value={note} />
          <input type="hidden" name="dateISO" value={date} />
          <input type="hidden" name="vendor" value={vendor} />
          <input type="hidden" name="location" value={location} />
```

4. Replace the existing "note" block (the `div` containing the note `<input>` and the `add.today` chip) with a note field plus a "More" disclosure. The keypad and Save button below it are untouched, so the fast flow is preserved:

```tsx
          {/* note */}
          <div className="flex items-center gap-2 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('add.note')}
              className="flex-1 bg-transparent text-base text-[var(--ink)] outline-none placeholder:text-[var(--faint)]"
            />
            <button
              type="button"
              onClick={() => setShowMore((v) => !v)}
              className="pressable-opacity shrink-0 rounded-full bg-[var(--subtle)] px-3 py-1 text-xs font-semibold text-[var(--muted)]"
            >
              {showMore ? t('add.today') : t('add.more')}
            </button>
          </div>

          {/* collapsible: date, vendor, location */}
          {showMore && (
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-[var(--muted)]">{t('add.date')}</span>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--ink)] outline-none"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-[var(--muted)]">{t('add.vendor')}</span>
                <input
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  className="w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--ink)] outline-none placeholder:text-[var(--faint)]"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-[var(--muted)]">{t('add.location')}</span>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--ink)] outline-none placeholder:text-[var(--faint)]"
                />
              </label>
            </div>
          )}
```

> The `add.today` chip label is reused as the "collapse" label when the section is open; `add.more` is the "expand" label.

- [ ] **Step 3: Add the new dictionary keys (both languages)**

In `src/i18n/dictionaries.ts` `en` block (next to `add.today`):

```ts
    'add.more': 'More',
    'add.vendor': 'Vendor',
    'add.location': 'Location',
    'add.date': 'Date',
```

`zh` block:

```ts
    'add.more': '更多',
    'add.vendor': '商家',
    'add.location': '地点',
    'add.date': '日期',
```

- [ ] **Step 4: Verify build & lint (no vitest surface — this is UI)**

Run: `npm run lint`
Expected: clean. Manually: `npm run dev`, open `/expenses/add`, confirm keypad still works, tap "More", set a past date + vendor + location, save, and see the row appear on the correct day with the vendor as its title.

- [ ] **Step 5: Commit**

```bash
git add src/app/(app)/expenses/add/actions.ts src/app/(app)/expenses/add/AddExpenseForm.tsx src/i18n/dictionaries.ts
git commit -m "feat(expenses): add-form date picker + collapsible vendor/location"
```

---

## Task 3: Edit-expense sheet — wire the inert swipe Edit

**Files:**
- Modify: `src/app/(app)/expenses/actions.ts` (add `updateExpenseAction`)
- Create: `src/app/(app)/expenses/edit/[id]/page.tsx`
- Create: `src/app/(app)/expenses/edit/[id]/EditExpenseForm.tsx`
- Modify: `src/app/(app)/expenses/ExpensesView.tsx` (Edit button → route)
- Modify: `src/i18n/dictionaries.ts` (add `edit.title`, `edit.saveChanges`)

**Interfaces:**
- Consumes: `parseExpenseForm`, `updateExpense`, `getExpense` (Task 1); `ExpenseRow` with `location`.
- Produces: `updateExpenseAction(formData: FormData)` (reads hidden `id`); route `/expenses/edit/<id>`.

- [ ] **Step 1: Add `updateExpenseAction` to the expenses actions**

Append to `src/app/(app)/expenses/actions.ts` (keep the existing `deleteExpenseAction`):

```ts
import { updateExpense } from '@/lib/data/expenses'
import { parseExpenseForm } from '@/lib/data/expenses-shared'
import { redirect } from 'next/navigation'

export async function updateExpenseAction(formData: FormData) {
  const id = formData.get('id')
  if (typeof id !== 'string' || !id) redirect('/expenses')
  const res = await updateExpense(id as string, parseExpenseForm(formData))
  if (!res.ok) redirect(`/expenses/edit/${id}?error=` + encodeURIComponent(res.error))
  revalidatePath('/expenses'); revalidatePath('/')
  redirect('/expenses')
}
```

> Note: `revalidatePath` is already imported at the top of the existing file; add only the three new imports shown.

- [ ] **Step 2: Create the edit page (server component that loads the row)**

Create `src/app/(app)/expenses/edit/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { getExpense } from '@/lib/data/expenses'
import { EditExpenseForm } from './EditExpenseForm'

export default async function EditExpensePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams
  const row = await getExpense(id)
  if (!row) notFound()
  return <EditExpenseForm row={row} error={error} />
}
```

- [ ] **Step 3: Create the edit form (client full-screen sheet)**

Create `src/app/(app)/expenses/edit/[id]/EditExpenseForm.tsx`:

```tsx
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useT, useLocale } from '@/i18n/LocaleProvider'
import { formatRM, parseMoneyInput } from '@/lib/money'
import { CATEGORIES, categoryLabel, type CategoryKey } from '@/lib/categories'
import { MemberAvatar } from '@/components/ui/MemberAvatar'
import { SubmitButton } from '@/components/ui/SubmitButton'
import type { ExpenseRow } from '@/lib/data/types'
import { updateExpenseAction } from '../../actions'

const MEMBERS = ['CH', 'JC'] as const

export function EditExpenseForm({ row, error }: { row: ExpenseRow; error?: string }) {
  const t = useT()
  const locale = useLocale()
  const [amount, setAmount] = useState((row.amount_cents / 100).toFixed(2))
  const [payer, setPayer] = useState<'CH' | 'JC' | null>(row.paid_by)
  const [category, setCategory] = useState<CategoryKey | null>((row.category as CategoryKey | null) ?? null)
  const [note, setNote] = useState(row.details ?? '')
  const [vendor, setVendor] = useState(row.vendor ?? '')
  const [location, setLocation] = useState(row.location ?? '')
  const [date, setDate] = useState(row.date)

  const cents = parseMoneyInput(amount)

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[var(--paper)]">
      <div className="mx-auto flex min-h-full max-w-[430px] flex-col px-[18px] pb-6 pt-4">
        <div className="flex items-center justify-between py-2">
          <Link
            href="/expenses"
            aria-label={t('common.back')}
            className="pressable-opacity grid h-11 w-11 place-items-center text-2xl text-[var(--muted)]"
          >
            ‹
          </Link>
          <h1 className="text-base font-bold text-[var(--ink-head)]">{t('edit.title')}</h1>
          <Link
            href="/expenses"
            aria-label={t('common.close')}
            className="pressable-opacity grid h-11 w-11 place-items-center text-2xl text-[var(--muted)]"
          >
            ×
          </Link>
        </div>

        <div className="flex flex-col items-center gap-1 py-6">
          <span className="text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">{t('add.amount')}</span>
          <div className="text-[36px] leading-none font-extrabold text-[var(--ink-head)]">{formatRM(cents)}</div>
        </div>

        <form action={updateExpenseAction} className="flex flex-1 flex-col gap-5">
          <input type="hidden" name="id" value={row.id} />
          <input type="hidden" name="amountCents" value={cents} />
          <input type="hidden" name="category" value={category ?? ''} />
          <input type="hidden" name="paidBy" value={payer ?? ''} />
          <input type="hidden" name="note" value={note} />
          <input type="hidden" name="dateISO" value={date} />
          <input type="hidden" name="vendor" value={vendor} />
          <input type="hidden" name="location" value={location} />

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-[var(--muted)]">{t('add.amount')}</span>
            <div className="flex items-center gap-2 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3">
              <span className="text-sm font-semibold text-[var(--muted)]">RM</span>
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="flex-1 bg-transparent text-base text-[var(--ink)] outline-none placeholder:text-[var(--faint)]"
              />
            </div>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-[var(--muted)]">{t('add.date')}</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--ink)] outline-none"
            />
          </label>

          <div>
            <p className="mb-2 text-sm font-semibold text-[var(--muted)]">{t('add.whoPaid')}</p>
            <div className="flex gap-2">
              {MEMBERS.map((mem) => {
                const selected = payer === mem
                const memberColor = mem === 'CH' ? 'var(--member-ch)' : 'var(--member-jc)'
                return (
                  <button
                    type="button"
                    key={mem}
                    onClick={() => setPayer((p) => (p === mem ? null : mem))}
                    className="pressable flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 font-semibold"
                    style={{
                      borderColor: selected ? memberColor : 'var(--hairline)',
                      background: selected ? memberColor : 'var(--surface)',
                      color: selected ? 'white' : 'var(--ink)',
                    }}
                  >
                    <MemberAvatar member={mem} size={24} />
                    {mem}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => {
              const selected = category === c.key
              return (
                <button
                  type="button"
                  key={c.key}
                  onClick={() => setCategory((cur) => (cur === c.key ? null : c.key))}
                  className="pressable flex min-h-[44px] items-center rounded-full border px-4 py-2.5 text-sm font-semibold whitespace-nowrap"
                  style={{
                    borderColor: selected ? 'var(--primary)' : 'var(--hairline)',
                    background: selected ? 'var(--primary)' : 'var(--surface)',
                    color: selected ? 'white' : 'var(--ink)',
                  }}
                >
                  {categoryLabel(c.key, locale)}
                </button>
              )
            })}
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-[var(--muted)]">{t('add.vendor')}</span>
            <input
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              className="w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--ink)] outline-none placeholder:text-[var(--faint)]"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-[var(--muted)]">{t('add.location')}</span>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--ink)] outline-none placeholder:text-[var(--faint)]"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-[var(--muted)]">{t('add.note')}</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--ink)] outline-none placeholder:text-[var(--faint)]"
            />
          </label>

          {error && <p className="text-sm font-semibold text-[var(--danger)]">{t(`error.${error}`)}</p>}

          <div className="flex-1" />

          <SubmitButton
            disabled={cents <= 0}
            className="w-full rounded-xl bg-[var(--primary-btn)] py-3.5 font-bold text-white disabled:opacity-40"
          >
            {t('edit.saveChanges')}
          </SubmitButton>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Wire the swipe Edit button to the route**

In `src/app/(app)/expenses/ExpensesView.tsx`, inside `ExpenseRowCard`, add a router near the top of the component:

```tsx
  const router = useRouter()
```

(`useRouter` is already imported at the top of the file.) Then replace the Edit button's `onClick`:

```tsx
        <button
          type="button"
          onClick={() => router.push(`/expenses/edit/${row.id}`)}
          className="pressable-opacity flex h-full flex-1 items-center justify-center text-sm font-bold text-white"
          style={{ background: 'var(--pending-text)' }}
        >
          {t('expenses.edit')}
        </button>
```

- [ ] **Step 5: Add dictionary keys (both languages)**

`en`:

```ts
    'edit.title': 'Edit Expense',
    'edit.saveChanges': 'Save Changes',
```

`zh`:

```ts
    'edit.title': '编辑开支',
    'edit.saveChanges': '保存修改',
```

- [ ] **Step 6: Verify**

Run: `npm run lint`
Expected: clean. Manually: swipe a row → Edit → change amount/date/category → Save → row reflects the change; the month total updates.

- [ ] **Step 7: Commit**

```bash
git add src/app/(app)/expenses/actions.ts "src/app/(app)/expenses/edit" src/app/(app)/expenses/ExpensesView.tsx src/i18n/dictionaries.ts
git commit -m "feat(expenses): editable expenses via /expenses/edit/[id]"
```

---

## Task 4: Personal ledger — edit & delete entries

**Files:**
- Modify: `src/lib/data/personal-shared.ts` (add `LedgerInput`, `validateLedgerInput`)
- Modify: `src/lib/data/personal-shared.test.ts`
- Modify: `src/app/(app)/personal/actions.ts` (add `updateLedgerEntry`, `deleteLedgerEntry`)
- Modify: `src/app/(app)/personal/PersonalView.tsx` (editable rows)
- Modify: `src/i18n/dictionaries.ts` (add `personal.editEntry`, `personal.delete`, `personal.save`, `error.invalid_description`)

**Interfaces:**
- Produces:
  - `type LedgerInput = { entryType: 'income' | 'expense'; description: string; amountCents: number }`
  - `validateLedgerInput(input: LedgerInput): { ok: true } | { ok: false; error: string }`
  - `updateLedgerEntry(input: { id: string } & LedgerInput): Promise<{ ok: boolean; error?: string }>`
  - `deleteLedgerEntry(id: string): Promise<{ ok: boolean }>`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/data/personal-shared.test.ts`:

```ts
import { validateLedgerInput } from './personal-shared'

describe('validateLedgerInput', () => {
  const base = { entryType: 'expense' as const, description: 'Lunch', amountCents: 1500 }
  it('accepts a valid entry', () => {
    expect(validateLedgerInput(base)).toEqual({ ok: true })
  })
  it('rejects an empty description', () => {
    expect(validateLedgerInput({ ...base, description: '   ' })).toEqual({ ok: false, error: 'invalid_description' })
  })
  it('rejects a bad type', () => {
    expect(validateLedgerInput({ ...base, entryType: 'x' as unknown as 'income' })).toEqual({ ok: false, error: 'invalid_type' })
  })
  it('rejects a non-positive amount', () => {
    expect(validateLedgerInput({ ...base, amountCents: 0 })).toEqual({ ok: false, error: 'invalid_amount' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/data/personal-shared.test.ts`
Expected: FAIL — `validateLedgerInput` is not exported.

- [ ] **Step 3: Add `LedgerInput` + `validateLedgerInput` to the shared module**

Append to `src/lib/data/personal-shared.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/data/personal-shared.test.ts`
Expected: PASS.

- [ ] **Step 5: Add `updateLedgerEntry` and `deleteLedgerEntry` actions**

Append to `src/app/(app)/personal/actions.ts` (imports `createClient`, `getMembership`, `revalidatePath` already present). Add one import at the top:

```ts
import { validateLedgerInput } from '@/lib/data/personal-shared'
```

then append:

```ts
export async function updateLedgerEntry(input: {
  id: string
  entryType: 'income' | 'expense'
  description: string
  amountCents: number
}): Promise<{ ok: boolean; error?: string }> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }
  const valid = validateLedgerInput(input)
  if (!valid.ok) return { ok: false, error: valid.error }
  const supabase = await createClient()
  const { error } = await supabase.from('ledger_entries')
    .update({ entry_type: input.entryType, description: input.description.trim(), amount_cents: input.amountCents })
    .eq('id', input.id).eq('household_id', m.householdId)
  if (error) { console.error('updateLedgerEntry:', error.message); return { ok: false, error: 'save_failed' } }
  revalidatePath('/personal'); revalidatePath('/')
  return { ok: true }
}

export async function deleteLedgerEntry(id: string): Promise<{ ok: boolean }> {
  const m = await getMembership()
  if (!m) return { ok: false }
  const supabase = await createClient()
  const { error } = await supabase.from('ledger_entries').delete().eq('id', id).eq('household_id', m.householdId)
  if (error) { console.error('deleteLedgerEntry:', error.message); return { ok: false } }
  revalidatePath('/personal'); revalidatePath('/')
  return { ok: true }
}
```

- [ ] **Step 6: Make ledger rows editable in `PersonalView`**

In `src/app/(app)/personal/PersonalView.tsx`:

1. Update the import to add the new actions:

```tsx
import { addLedgerEntry, updateLedgerEntry, deleteLedgerEntry } from './actions'
```

2. Add `parseMoneyInput` — already imported. Add `useState` import — already present.

3. Replace the `LedgerCard` component's row rendering so each row is a `LedgerRow` that expands to an inline editor. Replace the whole `LedgerCard` function with:

```tsx
function LedgerCard({
  title,
  rows,
  totalCents,
  totalClassName,
}: {
  title: string
  rows: LedgerEntry[]
  totalCents: number
  totalClassName: string
}) {
  return (
    <Card className="flex flex-col gap-3">
      <span className="text-sm font-bold text-[var(--ink-head)]">{title}</span>
      {rows.length > 0 && (
        <div className="flex flex-col gap-2">
          {rows.map((r) => (
            <LedgerRow key={r.id} row={r} />
          ))}
        </div>
      )}
      <div className="flex items-center justify-between border-t border-[var(--hairline)] pt-3">
        <span className="text-xs font-semibold text-[var(--muted)]">{title}</span>
        <MoneyText cents={totalCents} className={`text-sm font-extrabold ${totalClassName}`} />
      </div>
    </Card>
  )
}

function LedgerRow({ row }: { row: LedgerEntry }) {
  const t = useT()
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [description, setDescription] = useState(row.description)
  const [amount, setAmount] = useState((row.amountCents / 100).toFixed(2))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cents = parseMoneyInput(amount)
  const canSave = cents > 0 && description.trim().length > 0 && !busy

  async function save() {
    if (!canSave) return
    setBusy(true)
    setError(null)
    const res = await updateLedgerEntry({
      id: row.id, entryType: row.entryType, description: description.trim(), amountCents: cents,
    })
    setBusy(false)
    if (!res.ok) { setError(res.error ?? 'save_failed'); return }
    setEditing(false)
    router.refresh()
  }

  async function remove() {
    setBusy(true)
    setError(null)
    const res = await deleteLedgerEntry(row.id)
    setBusy(false)
    if (!res.ok) { setError('delete_failed'); return }
    router.refresh()
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="pressable-opacity flex w-full items-center justify-between gap-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--ink)]">{row.description}</p>
          {row.remark && <p className="truncate text-xs text-[var(--muted)]">{row.remark}</p>}
        </div>
        <MoneyText cents={row.amountCents} className="shrink-0 text-sm font-bold text-[var(--ink-head)]" />
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[var(--hairline)] p-3">
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] outline-none"
      />
      <div className="flex items-center gap-2 rounded-lg border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2">
        <span className="text-xs font-semibold text-[var(--muted)]">RM</span>
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="flex-1 bg-transparent text-sm text-[var(--ink)] outline-none"
        />
      </div>
      {error && <p role="alert" className="text-xs font-semibold text-[var(--danger)]">{t(`error.${error}`)}</p>}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={!canSave}
          aria-busy={busy}
          className="pressable flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--primary-btn)] py-2 text-sm font-bold text-white disabled:opacity-40"
        >
          {busy && <Spinner size={16} />}
          {t('personal.save')}
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className="pressable min-h-[44px] rounded-lg border border-[var(--hairline)] px-3 py-2 text-sm font-bold text-[var(--danger)] disabled:opacity-40"
        >
          {t('personal.delete')}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          aria-label={t('common.close')}
          className="pressable-opacity grid h-11 w-11 place-items-center text-xl text-[var(--muted)]"
        >
          ×
        </button>
      </div>
    </div>
  )
}
```

> `useT`, `useRouter`, `useState`, `parseMoneyInput`, `Spinner`, and `MoneyText` are all already imported at the top of `PersonalView.tsx`.

- [ ] **Step 7: Add dictionary keys (both languages)**

`en`:

```ts
    'personal.editEntry': 'Edit entry',
    'personal.delete': 'Delete',
    'personal.save': 'Save',
    'error.invalid_description': 'Enter a description',
    'error.invalid_type': 'Invalid type',
```

`zh`:

```ts
    'personal.editEntry': '编辑记录',
    'personal.delete': '删除',
    'personal.save': '保存',
    'error.invalid_description': '请输入说明',
    'error.invalid_type': '无效类型',
```

- [ ] **Step 8: Verify**

Run: `npx vitest run src/lib/data/personal-shared.test.ts && npm run lint`
Expected: tests PASS, lint clean. Manually: tap a ledger row, change amount, Save; tap another, Delete; balance updates.

- [ ] **Step 9: Commit**

```bash
git add src/lib/data/personal-shared.ts src/lib/data/personal-shared.test.ts src/app/(app)/personal/actions.ts src/app/(app)/personal/PersonalView.tsx src/i18n/dictionaries.ts
git commit -m "feat(personal): edit and delete ledger entries"
```

---

## Task 5: Asset transactions — edit & delete

**Files:**
- Modify: `src/lib/data/assets-shared.ts` (add `TxnInput`, `validateTxnInput`)
- Modify: `src/lib/data/assets-shared.test.ts`
- Modify: `src/app/(app)/assets/actions.ts` (add `updateAssetTransaction`, `deleteAssetTransaction`)
- Create: `src/app/(app)/assets/[id]/txn/[txnId]/page.tsx`
- Create: `src/app/(app)/assets/[id]/txn/[txnId]/EditTxnForm.tsx`
- Modify: `src/app/(app)/assets/[id]/PropertyBody.tsx`, `VehicleBody.tsx`, `InvestmentBody.tsx`, `page.tsx` (add an Edit link per row)
- Modify: `src/i18n/dictionaries.ts` (add `asset.editTxn`, `asset.deleteTxn`, `asset.form.saveChanges`)

**Interfaces:**
- Produces:
  - `type TxnInput = { date: string; description: string | null; amountCents: number; direction: 'in' | 'out'; txnType: string | null; settled: boolean; seq: number | null; notes: string | null }`
  - `validateTxnInput(input: TxnInput): { ok: true } | { ok: false; error: string }`
  - `updateAssetTransaction(input: { id: string; assetId: string } & TxnInput): Promise<{ ok: boolean; error?: string }>`
  - `deleteAssetTransaction(input: { id: string; assetId: string }): Promise<{ ok: boolean }>`
  - `getTxn` is not added; the edit page reads the single txn via `getAsset(id)` then finds by id (keeps the data layer small).

- [ ] **Step 1: Write the failing test**

Append to `src/lib/data/assets-shared.test.ts`:

```ts
import { validateTxnInput, type TxnInput } from './assets-shared'

describe('validateTxnInput', () => {
  const base: TxnInput = {
    date: '2026-07-05', description: 'Bill', amountCents: 5000,
    direction: 'out', txnType: null, settled: false, seq: null, notes: null,
  }
  it('accepts a valid txn', () => {
    expect(validateTxnInput(base)).toEqual({ ok: true })
  })
  it('rejects a bad date', () => {
    expect(validateTxnInput({ ...base, date: 'nope' })).toEqual({ ok: false, error: 'invalid_date' })
  })
  it('rejects a non-positive amount', () => {
    expect(validateTxnInput({ ...base, amountCents: 0 })).toEqual({ ok: false, error: 'invalid_amount' })
  })
  it('rejects a bad direction', () => {
    expect(validateTxnInput({ ...base, direction: 'sideways' as unknown as 'in' })).toEqual({ ok: false, error: 'invalid_direction' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/data/assets-shared.test.ts`
Expected: FAIL — `validateTxnInput`/`TxnInput` not exported.

- [ ] **Step 3: Add `TxnInput` + `validateTxnInput` to the shared module**

Append to `src/lib/data/assets-shared.ts`:

```ts
export type TxnInput = {
  date: string
  description: string | null
  amountCents: number
  direction: 'in' | 'out'
  txnType: string | null
  settled: boolean
  seq: number | null
  notes: string | null
}

const TXN_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function validateTxnInput(input: TxnInput): { ok: true } | { ok: false; error: string } {
  if (!TXN_DATE_RE.test(input.date)) return { ok: false, error: 'invalid_date' }
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) return { ok: false, error: 'invalid_amount' }
  if (input.direction !== 'in' && input.direction !== 'out') return { ok: false, error: 'invalid_direction' }
  return { ok: true }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/data/assets-shared.test.ts`
Expected: PASS.

- [ ] **Step 5: Add update/delete txn actions**

Append to `src/app/(app)/assets/actions.ts`. Add one import at the top:

```ts
import { validateTxnInput, type TxnInput } from '@/lib/data/assets-shared'
```

then append:

```ts
export async function updateAssetTransaction(input: {
  id: string; assetId: string
} & TxnInput): Promise<{ ok: boolean; error?: string }> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }
  const valid = validateTxnInput(input)
  if (!valid.ok) return { ok: false, error: valid.error }
  const supabase = await createClient()
  const { error } = await supabase.from('asset_transactions').update({
    date: input.date, description: input.description, amount_cents: input.amountCents,
    direction: input.direction, txn_type: input.txnType, settled: input.settled,
    seq: input.seq, notes: input.notes,
  }).eq('id', input.id).eq('household_id', m.householdId)
  if (error) { console.error('updateAssetTransaction:', error.message); return { ok: false, error: 'save_failed' } }
  revalidatePath(`/assets/${input.assetId}`); revalidatePath('/assets')
  return { ok: true }
}

export async function deleteAssetTransaction(input: { id: string; assetId: string }): Promise<{ ok: boolean }> {
  const m = await getMembership()
  if (!m) return { ok: false }
  const supabase = await createClient()
  const { error } = await supabase.from('asset_transactions')
    .delete().eq('id', input.id).eq('household_id', m.householdId)
  if (error) { console.error('deleteAssetTransaction:', error.message); return { ok: false } }
  revalidatePath(`/assets/${input.assetId}`); revalidatePath('/assets')
  return { ok: true }
}
```

- [ ] **Step 6: Create the txn-edit page**

Create `src/app/(app)/assets/[id]/txn/[txnId]/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { getAsset } from '@/lib/data/assets'
import { EditTxnForm } from './EditTxnForm'

export default async function EditTxnPage({ params }: { params: Promise<{ id: string; txnId: string }> }) {
  const { id, txnId } = await params
  const result = await getAsset(id)
  if (!result) notFound()
  const txn = result.txns.find((t) => t.id === txnId)
  if (!txn) notFound()
  return <EditTxnForm assetId={id} txn={txn} assetType={result.asset.type} />
}
```

- [ ] **Step 7: Create the txn-edit form (client sheet with Save + Delete)**

Create `src/app/(app)/assets/[id]/txn/[txnId]/EditTxnForm.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useT } from '@/i18n/LocaleProvider'
import { Spinner } from '@/components/ui/Spinner'
import { parseMoneyInput } from '@/lib/money'
import type { AssetTxn, AssetType } from '@/lib/data/assets-shared'
import { updateAssetTransaction, deleteAssetTransaction } from '@/app/(app)/assets/actions'

export function EditTxnForm({
  assetId,
  txn,
  assetType,
}: {
  assetId: string
  txn: AssetTxn
  assetType: AssetType
}) {
  const t = useT()
  const router = useRouter()

  const [date, setDate] = useState(txn.date)
  const [description, setDescription] = useState(txn.description ?? '')
  const [amount, setAmount] = useState((txn.amountCents / 100).toFixed(2))
  const [direction, setDirection] = useState<'in' | 'out'>(txn.direction)
  const [txnType, setTxnType] = useState(txn.txnType ?? '')
  const [settled, setSettled] = useState(txn.settled)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cents = parseMoneyInput(amount)
  const canSave = cents > 0 && !busy

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!canSave) return
    setBusy(true)
    setError(null)
    const res = await updateAssetTransaction({
      id: txn.id, assetId, date, description: description.trim() || null, amountCents: cents,
      direction, txnType: txnType.trim() || null, settled, seq: txn.seq, notes: txn.notes,
    })
    setBusy(false)
    if (!res.ok) { setError(res.error ?? 'save_failed'); return }
    router.push(`/assets/${assetId}`)
  }

  async function remove() {
    setBusy(true)
    setError(null)
    const res = await deleteAssetTransaction({ id: txn.id, assetId })
    setBusy(false)
    if (!res.ok) { setError('delete_failed'); return }
    router.push(`/assets/${assetId}`)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[var(--paper)]">
      <div className="mx-auto flex min-h-full max-w-[430px] flex-col px-[18px] pb-6 pt-4">
        <div className="flex items-center justify-between py-2">
          <Link
            href={`/assets/${assetId}`}
            aria-label={t('common.back')}
            className="pressable-opacity grid h-11 w-11 place-items-center text-2xl text-[var(--muted)]"
          >
            ‹
          </Link>
          <h1 className="text-base font-bold text-[var(--ink-head)]">{t('asset.editTxn')}</h1>
          <div className="h-11 w-11" />
        </div>

        <form onSubmit={save} className="flex flex-1 flex-col gap-3 pt-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-[var(--muted)]">{t('asset.form.date')}</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--ink)] outline-none"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-[var(--muted)]">{t('asset.form.description')}</span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--ink)] outline-none placeholder:text-[var(--faint)]"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-[var(--muted)]">{t('asset.form.amount')}</span>
            <div className="flex items-center gap-2 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3">
              <span className="text-sm font-semibold text-[var(--muted)]">RM</span>
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="flex-1 bg-transparent text-base text-[var(--ink)] outline-none placeholder:text-[var(--faint)]"
              />
            </div>
          </label>

          <div className="flex gap-2">
            {(['in', 'out'] as const).map((d) => {
              const selected = direction === d
              const color = d === 'in' ? 'var(--positive-text)' : 'var(--primary)'
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDirection(d)}
                  className="pressable min-h-[44px] flex-1 rounded-xl border py-2.5 text-sm font-semibold"
                  style={{
                    borderColor: selected ? color : 'var(--hairline)',
                    background: selected ? color : 'var(--surface)',
                    color: selected ? 'white' : 'var(--ink)',
                  }}
                >
                  {t(d === 'in' ? 'asset.in' : 'asset.out')}
                </button>
              )
            })}
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-[var(--muted)]">{t('asset.form.txnType')}</span>
            <input
              value={txnType}
              onChange={(e) => setTxnType(e.target.value)}
              className="w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--ink)] outline-none placeholder:text-[var(--faint)]"
            />
          </label>

          <button
            type="button"
            onClick={() => setSettled((s) => !s)}
            className="pressable flex min-h-[44px] items-center justify-between rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-sm font-semibold text-[var(--ink)]"
          >
            <span>{assetType === 'property' ? t('asset.transferred') : t('status.paid')}</span>
            <span
              className="relative inline-block h-7 w-12 rounded-full transition-colors"
              style={{ background: settled ? 'var(--positive-text)' : 'var(--hairline)' }}
            >
              <span
                className="absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform"
                style={{ transform: settled ? 'translateX(22px)' : 'translateX(4px)' }}
              />
            </span>
          </button>

          {error && <p role="alert" className="text-sm font-semibold text-[var(--danger)]">{t(`error.${error}`)}</p>}

          <div className="flex-1" />

          <button
            type="submit"
            disabled={!canSave}
            aria-busy={busy}
            className="pressable flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary-btn)] py-3 text-sm font-bold text-white disabled:opacity-40"
          >
            {busy && <Spinner />}
            {t('asset.form.saveChanges')}
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="pressable min-h-[44px] w-full rounded-xl border border-[var(--hairline)] py-3 text-sm font-bold text-[var(--danger)] disabled:opacity-40"
          >
            {t('asset.deleteTxn')}
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 8: Add a per-row Edit link in each asset body**

The four bodies render txn rows differently; add a small `Pencil` link to `/assets/<assetId>/txn/<txnId>` on each.

**PropertyBody.tsx** — it already has `asset` (so `asset.id`) and `useRouter`. Add imports:

```tsx
import Link from 'next/link'
import { Pencil } from 'lucide-react'
```

Inside the txn `Card`, add an Edit link as the last child of the top `flex items-center gap-3` row (right after the amount `<span>`):

```tsx
                  <Link
                    href={`/assets/${asset.id}/txn/${txn.id}`}
                    aria-label={t('asset.editTxn')}
                    className="pressable-opacity grid h-8 w-8 shrink-0 place-items-center text-[var(--muted)]"
                  >
                    <Pencil size={15} />
                  </Link>
```

**VehicleBody.tsx** and **InvestmentBody.tsx** are server components that currently receive `{ txns, locale }`. Give them the asset id:

- In `[id]/page.tsx`, change the two call sites to pass `assetId`:

```tsx
      {asset.type === 'vehicle' && <VehicleBody txns={txns} locale={locale} assetId={asset.id} />}
      {asset.type === 'investment' && <InvestmentBody txns={txns} locale={locale} assetId={asset.id} />}
      {asset.type === 'other' && <GenericBody txns={txns} locale={locale} assetId={asset.id} />}
```

- In `VehicleBody.tsx`, change the signature to `export function VehicleBody({ txns, locale, assetId }: { txns: AssetTxn[]; locale: Locale; assetId: string })`, add `import Link from 'next/link'` and `import { Pencil } from 'lucide-react'`, and add after the `<MoneyText ... />`/`<StatusChip .../>` in each row:

```tsx
                    <Link
                      href={`/assets/${assetId}/txn/${row.id}`}
                      aria-label={t(locale, 'asset.editTxn')}
                      className="pressable-opacity grid h-8 w-8 shrink-0 place-items-center text-[var(--muted)]"
                    >
                      <Pencil size={15} />
                    </Link>
```

- In `InvestmentBody.tsx`, change the signature to `export function InvestmentBody({ txns, locale, assetId }: { txns: AssetTxn[]; locale: Locale; assetId: string })`, add the same two imports, and add the same `<Link>` block (with `row.id`) as the last child of each schedule row.

- In `[id]/page.tsx`, change `GenericBody` to accept `assetId` and render the link:

```tsx
function GenericBody({ txns, locale, assetId }: { txns: AssetTxn[]; locale: Locale; assetId: string }) {
  if (txns.length === 0) {
    return (
      <p className="py-10 text-center text-sm font-semibold text-[var(--faint)]">{t(locale, 'asset.empty')}</p>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      {txns.map((txn) => (
        <Card key={txn.id} className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[var(--ink)]">{txn.description ?? '—'}</p>
            <p className="text-xs text-[var(--muted)]">{txn.date}</p>
          </div>
          <MoneyText cents={txn.amountCents} className="shrink-0 text-sm font-bold text-[var(--ink-head)]" />
          <Link
            href={`/assets/${assetId}/txn/${txn.id}`}
            aria-label={t(locale, 'asset.editTxn')}
            className="pressable-opacity grid h-8 w-8 shrink-0 place-items-center text-[var(--muted)]"
          >
            <Pencil size={15} />
          </Link>
        </Card>
      ))}
    </div>
  )
}
```

Add to `[id]/page.tsx` imports: `import Link from 'next/link'` (already present) and `import { Pencil } from 'lucide-react'`.

- [ ] **Step 9: Add dictionary keys (both languages)**

`en`:

```ts
    'asset.editTxn': 'Edit transaction',
    'asset.deleteTxn': 'Delete transaction',
    'asset.form.saveChanges': 'Save Changes',
    'error.invalid_direction': 'Choose in or out',
```

`zh`:

```ts
    'asset.editTxn': '编辑交易',
    'asset.deleteTxn': '删除交易',
    'asset.form.saveChanges': '保存修改',
    'error.invalid_direction': '请选择收入或支出',
```

- [ ] **Step 10: Verify**

Run: `npx vitest run src/lib/data/assets-shared.test.ts && npm run lint`
Expected: tests PASS, lint clean. Manually: open a property/vehicle/investment asset, tap the pencil on a txn, edit amount/date, Save; delete a txn; balances/next-payment/paid figures update.

- [ ] **Step 11: Commit**

```bash
git add src/lib/data/assets-shared.ts src/lib/data/assets-shared.test.ts src/app/(app)/assets/actions.ts "src/app/(app)/assets/[id]" src/i18n/dictionaries.ts
git commit -m "feat(assets): edit and delete asset transactions"
```

---

## Task 6: Budget — manage categories & commitments (add/edit/delete/reorder)

**Files:**
- **Manual SQL (user runs in Supabase SQL editor):** add `sort_order` to `monthly_commitments`.
- Create: `src/lib/data/budget-shared.ts`
- Create: `src/lib/data/budget-shared.test.ts`
- Modify: `src/lib/data/budget.ts` (add raw reads with ids; order commitments by `sort_order`)
- Create: `src/app/(app)/budget/actions.ts`
- Create: `src/app/(app)/budget/manage/page.tsx`
- Create: `src/app/(app)/budget/manage/BudgetManager.tsx`
- Modify: `src/app/(app)/budget/page.tsx` (header "Manage" link)
- Modify: `src/i18n/dictionaries.ts`

**Interfaces:**
- Produces:
  - `type CategoryRow = { id: string; nameEn: string; jcCents: number; chCents: number; totalCents: number; sortOrder: number }`
  - `type CommitmentRow = { id: string; nameEn: string; amountCents: number; sortOrder: number }`
  - `moveItem<T>(items: T[], index: number, delta: -1 | 1): T[]` (pure)
  - `getBudgetCategoriesRaw(): Promise<CategoryRow[]>`, `getCommitmentsRaw(): Promise<CommitmentRow[]>`
  - actions: `createCategory`, `updateCategory`, `deleteCategory`, `reorderCategories`, `createCommitment`, `updateCommitment`, `deleteCommitment`, `reorderCommitments` (all return `{ ok: boolean; error?: string }`)

- [ ] **Step 1: The manual migration (record it, then the user runs it)**

Add this snippet to a new file `supabase/migrations/0003_commitment_sort.sql` **and** instruct the user (in the execution handoff) to paste it into the Supabase SQL editor — there is no migration runner in this repo:

```sql
-- Phase 7: allow reordering monthly commitments.
alter table monthly_commitments add column if not exists sort_order int not null default 0;
```

- [ ] **Step 2: Write the failing pure test**

Create `src/lib/data/budget-shared.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { moveItem } from './budget-shared'

describe('moveItem', () => {
  it('moves an item up', () => {
    expect(moveItem(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c'])
  })
  it('moves an item down', () => {
    expect(moveItem(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b'])
  })
  it('is a no-op at the top edge', () => {
    expect(moveItem(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c'])
  })
  it('is a no-op at the bottom edge', () => {
    expect(moveItem(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c'])
  })
  it('does not mutate the input', () => {
    const src = ['a', 'b', 'c']
    moveItem(src, 1, 1)
    expect(src).toEqual(['a', 'b', 'c'])
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/data/budget-shared.test.ts`
Expected: FAIL — cannot resolve `./budget-shared`.

- [ ] **Step 4: Create `budget-shared.ts`**

Create `src/lib/data/budget-shared.ts`:

```ts
// Pure, server/client-safe budget helpers and types — no supabase import here.
export type CategoryRow = {
  id: string
  nameEn: string
  jcCents: number
  chCents: number
  totalCents: number
  sortOrder: number
}
export type CommitmentRow = {
  id: string
  nameEn: string
  amountCents: number
  sortOrder: number
}

export function moveItem<T>(items: T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta
  if (target < 0 || target >= items.length) return items.slice()
  const next = items.slice()
  const [moved] = next.splice(index, 1)
  next.splice(target, 0, moved)
  return next
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/data/budget-shared.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Add raw reads to `budget.ts` and order commitments by `sort_order`**

In `src/lib/data/budget.ts`:

1. Add import at the top:

```ts
import type { CategoryRow, CommitmentRow } from './budget-shared'
```

2. In `getBudget`, change the `monthly_commitments` select to include and order by `sort_order`:

```ts
    supabase.from('monthly_commitments')
      .select('name_en, name_zh, amount_cents, sort_order')
      .eq('household_id', m.householdId).order('sort_order', { ascending: true }),
```

3. Append the two raw readers at the end of the file:

```ts
export async function getBudgetCategoriesRaw(): Promise<CategoryRow[]> {
  const m = await getMembership()
  if (!m) return []
  const supabase = await createClient()
  const { data, error } = await supabase.from('budget_categories')
    .select('id, name_en, jc_cents, ch_cents, total_cents, sort_order')
    .eq('household_id', m.householdId).order('sort_order', { ascending: true })
  if (error) { console.error('getBudgetCategoriesRaw:', error.message); return [] }
  return ((data ?? []) as { id: string; name_en: string; jc_cents: number; ch_cents: number; total_cents: number; sort_order: number }[])
    .map((c) => ({ id: c.id, nameEn: c.name_en, jcCents: c.jc_cents, chCents: c.ch_cents, totalCents: c.total_cents, sortOrder: c.sort_order }))
}

export async function getCommitmentsRaw(): Promise<CommitmentRow[]> {
  const m = await getMembership()
  if (!m) return []
  const supabase = await createClient()
  const { data, error } = await supabase.from('monthly_commitments')
    .select('id, name_en, amount_cents, sort_order')
    .eq('household_id', m.householdId).order('sort_order', { ascending: true })
  if (error) { console.error('getCommitmentsRaw:', error.message); return [] }
  return ((data ?? []) as { id: string; name_en: string; amount_cents: number; sort_order: number }[])
    .map((c) => ({ id: c.id, nameEn: c.name_en, amountCents: c.amount_cents, sortOrder: c.sort_order }))
}
```

- [ ] **Step 7: Create the budget actions**

Create `src/app/(app)/budget/actions.ts`:

```ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { getMembership } from '@/lib/data/household'
import { revalidatePath } from 'next/cache'

type Res = { ok: boolean; error?: string }

function revalidateBudget() {
  revalidatePath('/budget'); revalidatePath('/budget/manage'); revalidatePath('/')
}

export async function createCategory(input: { nameEn: string; jcCents: number; chCents: number }): Promise<Res> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }
  if (!input.nameEn.trim()) return { ok: false, error: 'invalid_name' }
  const supabase = await createClient()
  const { data: maxRow } = await supabase.from('budget_categories')
    .select('sort_order').eq('household_id', m.householdId).order('sort_order', { ascending: false }).limit(1).maybeSingle()
  const nextOrder = (maxRow?.sort_order ?? 0) + 1
  const { error } = await supabase.from('budget_categories').insert({
    household_id: m.householdId, name_en: input.nameEn.trim(), jc_cents: input.jcCents,
    ch_cents: input.chCents, total_cents: input.jcCents + input.chCents, sort_order: nextOrder,
  })
  if (error) { console.error('createCategory:', error.message); return { ok: false, error: 'save_failed' } }
  revalidateBudget()
  return { ok: true }
}

export async function updateCategory(input: { id: string; nameEn: string; jcCents: number; chCents: number }): Promise<Res> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }
  if (!input.nameEn.trim()) return { ok: false, error: 'invalid_name' }
  const supabase = await createClient()
  const { error } = await supabase.from('budget_categories').update({
    name_en: input.nameEn.trim(), jc_cents: input.jcCents, ch_cents: input.chCents,
    total_cents: input.jcCents + input.chCents,
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

export async function createCommitment(input: { nameEn: string; amountCents: number }): Promise<Res> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }
  if (!input.nameEn.trim()) return { ok: false, error: 'invalid_name' }
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) return { ok: false, error: 'invalid_amount' }
  const supabase = await createClient()
  const { data: maxRow } = await supabase.from('monthly_commitments')
    .select('sort_order').eq('household_id', m.householdId).order('sort_order', { ascending: false }).limit(1).maybeSingle()
  const nextOrder = (maxRow?.sort_order ?? 0) + 1
  const { error } = await supabase.from('monthly_commitments').insert({
    household_id: m.householdId, name_en: input.nameEn.trim(), amount_cents: input.amountCents, sort_order: nextOrder,
  })
  if (error) { console.error('createCommitment:', error.message); return { ok: false, error: 'save_failed' } }
  revalidateBudget()
  return { ok: true }
}

export async function updateCommitment(input: { id: string; nameEn: string; amountCents: number }): Promise<Res> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }
  if (!input.nameEn.trim()) return { ok: false, error: 'invalid_name' }
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) return { ok: false, error: 'invalid_amount' }
  const supabase = await createClient()
  const { error } = await supabase.from('monthly_commitments').update({
    name_en: input.nameEn.trim(), amount_cents: input.amountCents,
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
```

> `error.invalid_name` already exists (`assets.field` uses it in `createAsset`); confirm the key `error.invalid_name` is in the dictionary — it is **not** yet present, so add it in Step 10.

- [ ] **Step 8: Create the manage page (server component)**

Create `src/app/(app)/budget/manage/page.tsx`:

```tsx
import { getBudgetCategoriesRaw, getCommitmentsRaw } from '@/lib/data/budget'
import { BudgetManager } from './BudgetManager'

export default async function BudgetManagePage() {
  const [categories, commitments] = await Promise.all([getBudgetCategoriesRaw(), getCommitmentsRaw()])
  return <BudgetManager categories={categories} commitments={commitments} />
}
```

- [ ] **Step 9: Create the manager client component**

Create `src/app/(app)/budget/manage/BudgetManager.tsx`:

```tsx
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronUp, ChevronDown, Trash2, Plus } from 'lucide-react'
import { useT } from '@/i18n/LocaleProvider'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { parseMoneyInput } from '@/lib/money'
import { moveItem, type CategoryRow, type CommitmentRow } from '@/lib/data/budget-shared'
import {
  createCategory, updateCategory, deleteCategory, reorderCategories,
  createCommitment, updateCommitment, deleteCommitment, reorderCommitments,
} from '../actions'

export function BudgetManager({
  categories,
  commitments,
}: {
  categories: CategoryRow[]
  commitments: CommitmentRow[]
}) {
  const t = useT()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true)
    setError(null)
    const res = await fn()
    setBusy(false)
    if (!res.ok) { setError(res.error ?? 'save_failed'); return }
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-5 pb-6">
      <header className="flex items-center gap-3">
        <Link
          href="/budget"
          aria-label={t('common.back')}
          className="pressable-opacity grid h-11 w-11 shrink-0 place-items-center text-2xl text-[var(--muted)]"
        >
          ‹
        </Link>
        <h1 className="flex-1 truncate text-xl font-extrabold text-[var(--ink-head)]">{t('budget.manage')}</h1>
      </header>

      {error && (
        <p role="alert" className="rounded-xl bg-[var(--pending-bg)] px-4 py-2 text-sm font-semibold text-[var(--danger)]">
          {t(`error.${error}`)}
        </p>
      )}

      {/* categories */}
      <section className="flex flex-col gap-2">
        <span className="px-1 text-xs font-bold tracking-wide text-[var(--muted)] uppercase">{t('budget.title')}</span>
        {categories.map((c, i) => (
          <CategoryEditor
            key={c.id}
            row={c}
            disabled={busy}
            canUp={i > 0}
            canDown={i < categories.length - 1}
            onSave={(nameEn, jcCents, chCents) => run(() => updateCategory({ id: c.id, nameEn, jcCents, chCents }))}
            onDelete={() => run(() => deleteCategory(c.id))}
            onMove={(delta) => run(() => reorderCategories(moveItem(categories, i, delta).map((x) => x.id)))}
          />
        ))}
        <CategoryAdder disabled={busy} onAdd={(nameEn, jcCents, chCents) => run(() => createCategory({ nameEn, jcCents, chCents }))} />
      </section>

      {/* commitments */}
      <section className="flex flex-col gap-2">
        <span className="px-1 text-xs font-bold tracking-wide text-[var(--muted)] uppercase">{t('budget.commitments')}</span>
        {commitments.map((c, i) => (
          <CommitmentEditor
            key={c.id}
            row={c}
            disabled={busy}
            canUp={i > 0}
            canDown={i < commitments.length - 1}
            onSave={(nameEn, amountCents) => run(() => updateCommitment({ id: c.id, nameEn, amountCents }))}
            onDelete={() => run(() => deleteCommitment(c.id))}
            onMove={(delta) => run(() => reorderCommitments(moveItem(commitments, i, delta).map((x) => x.id)))}
          />
        ))}
        <CommitmentAdder disabled={busy} onAdd={(nameEn, amountCents) => run(() => createCommitment({ nameEn, amountCents }))} />
      </section>

      {busy && <div className="flex justify-center py-2"><Spinner /></div>}
    </div>
  )
}

function MoveButtons({ canUp, canDown, disabled, onMove }: {
  canUp: boolean; canDown: boolean; disabled: boolean; onMove: (delta: -1 | 1) => void
}) {
  return (
    <div className="flex shrink-0 flex-col">
      <button type="button" disabled={disabled || !canUp} onClick={() => onMove(-1)} aria-label="up"
        className="pressable-opacity grid h-6 w-8 place-items-center text-[var(--muted)] disabled:opacity-30">
        <ChevronUp size={16} />
      </button>
      <button type="button" disabled={disabled || !canDown} onClick={() => onMove(1)} aria-label="down"
        className="pressable-opacity grid h-6 w-8 place-items-center text-[var(--muted)] disabled:opacity-30">
        <ChevronDown size={16} />
      </button>
    </div>
  )
}

function CategoryEditor({ row, disabled, canUp, canDown, onSave, onDelete, onMove }: {
  row: CategoryRow; disabled: boolean; canUp: boolean; canDown: boolean
  onSave: (nameEn: string, jcCents: number, chCents: number) => void
  onDelete: () => void; onMove: (delta: -1 | 1) => void
}) {
  const t = useT()
  const [name, setName] = useState(row.nameEn)
  const [jc, setJc] = useState((row.jcCents / 100).toFixed(2))
  const [ch, setCh] = useState((row.chCents / 100).toFixed(2))
  return (
    <Card className="flex items-start gap-2">
      <MoveButtons canUp={canUp} canDown={canDown} disabled={disabled} onMove={onMove} />
      <div className="flex flex-1 flex-col gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--ink)] outline-none" />
        <div className="flex gap-2">
          <MoneyMini label="JC" value={jc} onChange={setJc} />
          <MoneyMini label="CH" value={ch} onChange={setCh} />
        </div>
        <div className="flex gap-2">
          <button type="button" disabled={disabled} onClick={() => onSave(name, parseMoneyInput(jc), parseMoneyInput(ch))}
            className="pressable min-h-[40px] flex-1 rounded-lg bg-[var(--primary-btn)] text-sm font-bold text-white disabled:opacity-40">
            {t('personal.save')}
          </button>
          <button type="button" disabled={disabled} onClick={onDelete} aria-label={t('personal.delete')}
            className="pressable grid min-h-[40px] w-11 place-items-center rounded-lg border border-[var(--hairline)] text-[var(--danger)] disabled:opacity-40">
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </Card>
  )
}

function CategoryAdder({ disabled, onAdd }: { disabled: boolean; onAdd: (nameEn: string, jcCents: number, chCents: number) => void }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [jc, setJc] = useState('')
  const [ch, setCh] = useState('')
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="pressable flex min-h-[44px] w-full items-center justify-center gap-1 rounded-xl border border-dashed border-[var(--primary)] py-3 text-sm font-bold text-[var(--primary)]">
        <Plus size={16} /> {t('budget.addCategory')}
      </button>
    )
  }
  return (
    <Card className="flex flex-col gap-2">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('budget.categoryName')}
        className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--faint)]" />
      <div className="flex gap-2">
        <MoneyMini label="JC" value={jc} onChange={setJc} />
        <MoneyMini label="CH" value={ch} onChange={setCh} />
      </div>
      <div className="flex gap-2">
        <button type="button" disabled={disabled || !name.trim()}
          onClick={() => { onAdd(name, parseMoneyInput(jc), parseMoneyInput(ch)); setOpen(false); setName(''); setJc(''); setCh('') }}
          className="pressable min-h-[40px] flex-1 rounded-lg bg-[var(--primary-btn)] text-sm font-bold text-white disabled:opacity-40">
          {t('budget.add')}
        </button>
        <button type="button" onClick={() => setOpen(false)} aria-label={t('common.close')}
          className="pressable-opacity grid h-10 w-10 place-items-center text-xl text-[var(--muted)]">×</button>
      </div>
    </Card>
  )
}

function CommitmentEditor({ row, disabled, canUp, canDown, onSave, onDelete, onMove }: {
  row: CommitmentRow; disabled: boolean; canUp: boolean; canDown: boolean
  onSave: (nameEn: string, amountCents: number) => void
  onDelete: () => void; onMove: (delta: -1 | 1) => void
}) {
  const t = useT()
  const [name, setName] = useState(row.nameEn)
  const [amount, setAmount] = useState((row.amountCents / 100).toFixed(2))
  return (
    <Card className="flex items-center gap-2">
      <MoveButtons canUp={canUp} canDown={canDown} disabled={disabled} onMove={onMove} />
      <input value={name} onChange={(e) => setName(e.target.value)}
        className="min-w-0 flex-1 rounded-lg border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--ink)] outline-none" />
      <div className="flex w-24 shrink-0 items-center gap-1 rounded-lg border border-[var(--hairline)] bg-[var(--surface)] px-2 py-2">
        <span className="text-xs text-[var(--muted)]">RM</span>
        <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)}
          className="w-full bg-transparent text-sm text-[var(--ink)] outline-none" />
      </div>
      <button type="button" disabled={disabled} onClick={() => onSave(name, parseMoneyInput(amount))}
        className="pressable min-h-[40px] shrink-0 rounded-lg bg-[var(--primary-btn)] px-3 text-sm font-bold text-white disabled:opacity-40">
        {t('personal.save')}
      </button>
      <button type="button" disabled={disabled} onClick={onDelete} aria-label={t('personal.delete')}
        className="pressable grid min-h-[40px] w-10 shrink-0 place-items-center rounded-lg border border-[var(--hairline)] text-[var(--danger)] disabled:opacity-40">
        <Trash2 size={16} />
      </button>
    </Card>
  )
}

function CommitmentAdder({ disabled, onAdd }: { disabled: boolean; onAdd: (nameEn: string, amountCents: number) => void }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="pressable flex min-h-[44px] w-full items-center justify-center gap-1 rounded-xl border border-dashed border-[var(--primary)] py-3 text-sm font-bold text-[var(--primary)]">
        <Plus size={16} /> {t('budget.addCommitment')}
      </button>
    )
  }
  return (
    <Card className="flex flex-col gap-2">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('budget.commitmentName')}
        className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--faint)]" />
      <div className="flex items-center gap-2 rounded-lg border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2">
        <span className="text-xs text-[var(--muted)]">RM</span>
        <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
          className="flex-1 bg-transparent text-sm text-[var(--ink)] outline-none" />
      </div>
      <div className="flex gap-2">
        <button type="button" disabled={disabled || !name.trim()}
          onClick={() => { onAdd(name, parseMoneyInput(amount)); setOpen(false); setName(''); setAmount('') }}
          className="pressable min-h-[40px] flex-1 rounded-lg bg-[var(--primary-btn)] text-sm font-bold text-white disabled:opacity-40">
          {t('budget.add')}
        </button>
        <button type="button" onClick={() => setOpen(false)} aria-label={t('common.close')}
          className="pressable-opacity grid h-10 w-10 place-items-center text-xl text-[var(--muted)]">×</button>
      </div>
    </Card>
  )
}

function MoneyMini({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-1 items-center gap-1 rounded-lg border border-[var(--hairline)] bg-[var(--surface)] px-2 py-2">
      <span className="text-xs font-semibold text-[var(--muted)]">{label}</span>
      <input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} placeholder="0.00"
        className="w-full bg-transparent text-sm text-[var(--ink)] outline-none" />
    </div>
  )
}
```

- [ ] **Step 10: Add the "Manage" link to the budget header + dictionary keys**

In `src/app/(app)/budget/page.tsx`, add `import Link from 'next/link'` and replace the header's month `<span>` block with the month chip plus a Manage link:

```tsx
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-[var(--ink-head)]">{t(locale, 'budget.title')}</h1>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[var(--subtle)] px-3 py-1 text-xs font-bold text-[var(--muted)]">
            {monthLabel}
          </span>
          <Link
            href="/budget/manage"
            className="pressable rounded-full bg-[var(--primary-btn)] px-3 py-1 text-xs font-bold text-white"
          >
            {t(locale, 'budget.manage')}
          </Link>
        </div>
      </header>
```

Dictionary `en`:

```ts
    'budget.manage': 'Manage',
    'budget.addCategory': 'Add category',
    'budget.addCommitment': 'Add commitment',
    'budget.categoryName': 'Category name',
    'budget.commitmentName': 'Commitment name',
    'budget.add': 'Add',
    'error.invalid_name': 'Enter a name',
```

`zh`:

```ts
    'budget.manage': '管理',
    'budget.addCategory': '添加类别',
    'budget.addCommitment': '添加固定支出',
    'budget.categoryName': '类别名称',
    'budget.commitmentName': '支出名称',
    'budget.add': '添加',
    'error.invalid_name': '请输入名称',
```

- [ ] **Step 11: Verify**

Run: `npx vitest run src/lib/data/budget-shared.test.ts && npm run lint`
Expected: tests PASS, lint clean. Manually (after running the SQL snippet): open `/budget` → Manage; add a category, edit split, reorder up/down, delete; add/edit/reorder/delete a commitment; return to `/budget` and confirm totals + order changed.

- [ ] **Step 12: Commit**

```bash
git add src/lib/data/budget-shared.ts src/lib/data/budget-shared.test.ts src/lib/data/budget.ts "src/app/(app)/budget" supabase/migrations/0003_commitment_sort.sql src/i18n/dictionaries.ts
git commit -m "feat(budget): manage categories & commitments (add/edit/delete/reorder)"
```

---

## Task 7: Joint fund — edit config (expected monthly + carry-forward per member)

**Files:**
- Modify: `src/lib/data/fund.ts` (add `getFundConfig`)
- Modify: `src/app/(app)/fund/actions.ts` (add `updateFundConfig`)
- Modify: `src/app/(app)/fund/page.tsx` (pass config; render editor)
- Create: `src/app/(app)/fund/FundConfigEditor.tsx`
- Modify: `src/app/(app)/fund/FundView.tsx` (add an Edit-config affordance in the header that toggles the editor)
- Modify: `src/i18n/dictionaries.ts`

**Interfaces:**
- Produces:
  - `type FundConfig = { CH: { expectedMonthlyCents: number; carryForwardCents: number }; JC: { expectedMonthlyCents: number; carryForwardCents: number } }`
  - `getFundConfig(): Promise<FundConfig>`
  - `updateFundConfig(input: FundConfig): Promise<{ ok: boolean; error?: string }>`

- [ ] **Step 1: Add `getFundConfig` to the data layer**

Append to `src/lib/data/fund.ts`:

```ts
export type FundConfig = {
  CH: { expectedMonthlyCents: number; carryForwardCents: number }
  JC: { expectedMonthlyCents: number; carryForwardCents: number }
}

export async function getFundConfig(): Promise<FundConfig> {
  const empty: FundConfig = { CH: { expectedMonthlyCents: 0, carryForwardCents: 0 }, JC: { expectedMonthlyCents: 0, carryForwardCents: 0 } }
  const m = await getMembership()
  if (!m) return empty
  const supabase = await createClient()
  const { data, error } = await supabase.from('joint_fund_config')
    .select('member_code, expected_monthly_cents, carry_forward_prev_year_cents')
    .eq('household_id', m.householdId)
  if (error) { console.error('getFundConfig:', error.message); return empty }
  const out: FundConfig = { CH: { expectedMonthlyCents: 0, carryForwardCents: 0 }, JC: { expectedMonthlyCents: 0, carryForwardCents: 0 } }
  for (const r of (data ?? []) as { member_code: 'CH' | 'JC'; expected_monthly_cents: number; carry_forward_prev_year_cents: number }[]) {
    out[r.member_code] = { expectedMonthlyCents: r.expected_monthly_cents, carryForwardCents: r.carry_forward_prev_year_cents }
  }
  return out
}
```

- [ ] **Step 2: Add `updateFundConfig` action (upsert both members)**

Append to `src/app/(app)/fund/actions.ts`:

```ts
import type { FundConfig } from '@/lib/data/fund'

export async function updateFundConfig(input: FundConfig): Promise<{ ok: boolean; error?: string }> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }
  for (const code of ['CH', 'JC'] as const) {
    const c = input[code]
    if (!Number.isInteger(c.expectedMonthlyCents) || c.expectedMonthlyCents < 0) return { ok: false, error: 'invalid_amount' }
    if (!Number.isInteger(c.carryForwardCents)) return { ok: false, error: 'invalid_amount' }
  }
  const supabase = await createClient()
  const rows = (['CH', 'JC'] as const).map((code) => ({
    household_id: m.householdId, member_code: code,
    expected_monthly_cents: input[code].expectedMonthlyCents,
    carry_forward_prev_year_cents: input[code].carryForwardCents,
  }))
  const { error } = await supabase.from('joint_fund_config')
    .upsert(rows, { onConflict: 'household_id,member_code' })
  if (error) { console.error('updateFundConfig:', error.message); return { ok: false, error: 'save_failed' } }
  revalidatePath('/fund'); revalidatePath('/')
  return { ok: true }
}
```

> `joint_fund_config`'s primary key is `(household_id, member_code)`, so `onConflict: 'household_id,member_code'` upserts existing rows cleanly.

- [ ] **Step 3: Create the config editor (client sheet)**

Create `src/app/(app)/fund/FundConfigEditor.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/i18n/LocaleProvider'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { MemberAvatar } from '@/components/ui/MemberAvatar'
import { parseMoneyInput } from '@/lib/money'
import type { FundConfig } from '@/lib/data/fund'
import { updateFundConfig } from './actions'

export function FundConfigEditor({ config, onClose }: { config: FundConfig; onClose: () => void }) {
  const t = useT()
  const router = useRouter()
  const [chMonthly, setChMonthly] = useState((config.CH.expectedMonthlyCents / 100).toFixed(2))
  const [chCarry, setChCarry] = useState((config.CH.carryForwardCents / 100).toFixed(2))
  const [jcMonthly, setJcMonthly] = useState((config.JC.expectedMonthlyCents / 100).toFixed(2))
  const [jcCarry, setJcCarry] = useState((config.JC.carryForwardCents / 100).toFixed(2))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setBusy(true)
    setError(null)
    const res = await updateFundConfig({
      CH: { expectedMonthlyCents: parseMoneyInput(chMonthly), carryForwardCents: parseMoneyInput(chCarry) },
      JC: { expectedMonthlyCents: parseMoneyInput(jcMonthly), carryForwardCents: parseMoneyInput(jcCarry) },
    })
    setBusy(false)
    if (!res.ok) { setError(res.error ?? 'save_failed'); return }
    onClose()
    router.refresh()
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-[var(--ink-head)]">{t('fund.editConfig')}</span>
        <button type="button" onClick={onClose} aria-label={t('common.close')}
          className="pressable-opacity grid h-11 w-11 place-items-center text-xl text-[var(--muted)]">×</button>
      </div>
      {(['CH', 'JC'] as const).map((code) => {
        const monthly = code === 'CH' ? chMonthly : jcMonthly
        const setMonthly = code === 'CH' ? setChMonthly : setJcMonthly
        const carry = code === 'CH' ? chCarry : jcCarry
        const setCarry = code === 'CH' ? setChCarry : setJcCarry
        return (
          <div key={code} className="flex flex-col gap-2 border-t border-[var(--hairline)] pt-3 first:border-t-0 first:pt-0">
            <div className="flex items-center gap-2">
              <MemberAvatar member={code} size={24} />
              <span className="text-sm font-bold text-[var(--ink-head)]">{code}</span>
            </div>
            <ConfigField label={t('fund.expectedMonthly')} value={monthly} onChange={setMonthly} />
            <ConfigField label={t('fund.carryForward')} value={carry} onChange={setCarry} />
          </div>
        )
      })}
      {error && <p role="alert" className="text-sm font-semibold text-[var(--danger)]">{t(`error.${error}`)}</p>}
      <button type="button" onClick={save} disabled={busy} aria-busy={busy}
        className="pressable flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary-btn)] py-3 text-sm font-bold text-white disabled:opacity-40">
        {busy && <Spinner size={16} />}
        {t('personal.save')}
      </button>
    </Card>
  )
}

function ConfigField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-[var(--muted)]">{label}</span>
      <div className="flex items-center gap-2 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3">
        <span className="text-sm font-semibold text-[var(--muted)]">RM</span>
        <input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} placeholder="0.00"
          className="flex-1 bg-transparent text-base text-[var(--ink)] outline-none placeholder:text-[var(--faint)]" />
      </div>
    </label>
  )
}
```

- [ ] **Step 4: Pass config into `FundView` and render the editor toggle**

In `src/app/(app)/fund/page.tsx`, read the config and pass it. Locate the existing `getFundOverview` call and add `getFundConfig`:

```tsx
import { getFundOverview, getFundConfig } from '@/lib/data/fund'
```

Then add `getFundConfig()` to the existing `Promise.all` (which currently returns `[overview, membership]`):

```tsx
  const [overview, membership, config] = await Promise.all([getFundOverview(year), getMembership(), getFundConfig()])
  const locale = membership?.language ?? 'en'

  return <FundView overview={overview} locale={locale} month={month} config={config} />
```

In `src/app/(app)/fund/FundView.tsx`:

1. Add imports:

```tsx
import { Pencil } from 'lucide-react'
import type { FundConfig } from '@/lib/data/fund'
import { FundConfigEditor } from './FundConfigEditor'
```

2. Extend `Props` and the function signature to accept `config: FundConfig`, and add editor state:

```tsx
type Props = {
  overview: FundOverview
  locale: Locale
  month: number
  config: FundConfig
}

export function FundView({ overview, locale, month, config }: Props) {
```

3. Just below `const [pendingKey, setPendingKey] = useState<string | null>(null)`, add:

```tsx
  const [editingConfig, setEditingConfig] = useState(false)
```

4. In the header, add an edit button next to the year chip:

```tsx
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-[var(--ink-head)]">{t('fund.title')}</h1>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[var(--subtle)] px-3 py-1 text-xs font-bold text-[var(--muted)]">
            {overview.year}
          </span>
          <button
            type="button"
            onClick={() => setEditingConfig((v) => !v)}
            aria-label={t('fund.editConfig')}
            className="pressable-opacity grid h-9 w-9 place-items-center rounded-full text-[var(--muted)]"
          >
            <Pencil size={16} />
          </button>
        </div>
      </header>

      {editingConfig && <FundConfigEditor config={config} onClose={() => setEditingConfig(false)} />}
```

(Replace the existing `<header>...</header>` block, which currently holds only the title and the year chip.)

- [ ] **Step 5: Add dictionary keys (both languages)**

`en`:

```ts
    'fund.editConfig': 'Edit fund config',
    'fund.expectedMonthly': 'Expected monthly',
```

`zh`:

```ts
    'fund.editConfig': '编辑基金设置',
    'fund.expectedMonthly': '每月预期',
```

(`fund.carryForward` already exists and is reused.)

- [ ] **Step 6: Verify**

Run: `npm run lint`
Expected: clean. Manually: open `/fund`, tap the pencil, change CH/JC expected monthly and carry-forward, Save; the hero "of year" total and the per-month-each chip update.

- [ ] **Step 7: Commit**

```bash
git add src/lib/data/fund.ts "src/app/(app)/fund" src/i18n/dictionaries.ts
git commit -m "feat(fund): edit joint-fund config (expected monthly + carry-forward)"
```

---

## Task 8: Assets — close/reopen, edit name/metadata, dim closed in list

**Files:**
- Modify: `src/lib/data/assets-shared.ts` (add `splitByStatus`)
- Modify: `src/lib/data/assets-shared.test.ts`
- Modify: `src/app/(app)/assets/actions.ts` (add `updateAsset`, `setAssetStatus`)
- Create: `src/app/(app)/assets/[id]/edit/page.tsx`
- Create: `src/app/(app)/assets/[id]/edit/EditAssetForm.tsx`
- Modify: `src/app/(app)/assets/[id]/page.tsx` (header: edit link + close/reopen; closed banner)
- Modify: `src/app/(app)/assets/page.tsx` (dim + collapse closed assets)
- Modify: `src/i18n/dictionaries.ts`

**Interfaces:**
- Produces:
  - `splitByStatus<T extends { status: 'active' | 'closed' }>(assets: T[]): { active: T[]; closed: T[] }`
  - `updateAsset(input: { id: string; name: string; metadata: Record<string, unknown> }): Promise<{ ok: boolean; error?: string }>`
  - `setAssetStatus(input: { id: string; status: 'active' | 'closed' }): Promise<{ ok: boolean }>`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/data/assets-shared.test.ts`:

```ts
import { splitByStatus } from './assets-shared'

describe('splitByStatus', () => {
  it('partitions active and closed preserving order', () => {
    const items = [
      { id: '1', status: 'active' as const },
      { id: '2', status: 'closed' as const },
      { id: '3', status: 'active' as const },
    ]
    const { active, closed } = splitByStatus(items)
    expect(active.map((a) => a.id)).toEqual(['1', '3'])
    expect(closed.map((a) => a.id)).toEqual(['2'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/data/assets-shared.test.ts`
Expected: FAIL — `splitByStatus` not exported.

- [ ] **Step 3: Add `splitByStatus`**

Append to `src/lib/data/assets-shared.ts`:

```ts
export function splitByStatus<T extends { status: 'active' | 'closed' }>(assets: T[]): { active: T[]; closed: T[] } {
  return {
    active: assets.filter((a) => a.status === 'active'),
    closed: assets.filter((a) => a.status === 'closed'),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/data/assets-shared.test.ts`
Expected: PASS.

- [ ] **Step 5: Add `updateAsset` and `setAssetStatus` actions**

Append to `src/app/(app)/assets/actions.ts`:

```ts
export async function updateAsset(input: {
  id: string; name: string; metadata: Record<string, unknown>
}): Promise<{ ok: boolean; error?: string }> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }
  if (!input.name.trim()) return { ok: false, error: 'invalid_name' }
  const supabase = await createClient()
  const { error } = await supabase.from('assets')
    .update({ name: input.name.trim(), metadata: input.metadata })
    .eq('id', input.id).eq('household_id', m.householdId)
  if (error) { console.error('updateAsset:', error.message); return { ok: false, error: 'save_failed' } }
  revalidatePath(`/assets/${input.id}`); revalidatePath('/assets')
  return { ok: true }
}

export async function setAssetStatus(input: { id: string; status: 'active' | 'closed' }): Promise<{ ok: boolean }> {
  const m = await getMembership()
  if (!m) return { ok: false }
  const supabase = await createClient()
  const { error } = await supabase.from('assets')
    .update({ status: input.status }).eq('id', input.id).eq('household_id', m.householdId)
  if (error) { console.error('setAssetStatus:', error.message); return { ok: false } }
  revalidatePath(`/assets/${input.id}`); revalidatePath('/assets')
  return { ok: true }
}
```

- [ ] **Step 6: Create the edit-asset page**

Create `src/app/(app)/assets/[id]/edit/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { getAsset } from '@/lib/data/assets'
import { EditAssetForm } from './EditAssetForm'

export default async function EditAssetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await getAsset(id)
  if (!result) notFound()
  return <EditAssetForm asset={result.asset} />
}
```

- [ ] **Step 7: Create the edit-asset form (name + status + type-specific metadata)**

Create `src/app/(app)/assets/[id]/edit/EditAssetForm.tsx`:

```tsx
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useT } from '@/i18n/LocaleProvider'
import { Spinner } from '@/components/ui/Spinner'
import { parseMoneyInput } from '@/lib/money'
import type { Asset } from '@/lib/data/assets-shared'
import { updateAsset, setAssetStatus } from '@/app/(app)/assets/actions'

function metaString(md: Record<string, unknown>, key: string): string {
  const v = md[key]
  return typeof v === 'string' ? v : ''
}
function metaMoney(md: Record<string, unknown>, key: string): string {
  const v = md[key]
  return typeof v === 'number' ? (v / 100).toFixed(2) : ''
}

export function EditAssetForm({ asset }: { asset: Asset }) {
  const t = useT()
  const router = useRouter()
  const md = asset.metadata ?? {}

  const [name, setName] = useState(asset.name)
  const [address, setAddress] = useState(metaString(md, 'address'))
  const [monthlyCommitment, setMonthlyCommitment] = useState(metaMoney(md, 'monthlyCommitmentCents'))
  const [plate, setPlate] = useState(metaString(md, 'plate'))
  const [installment, setInstallment] = useState(metaMoney(md, 'installmentCents'))
  const [notes, setNotes] = useState(metaString(md, 'notes'))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function buildMetadata(): Record<string, unknown> {
    if (asset.type === 'property') return { ...md, address, monthlyCommitmentCents: parseMoneyInput(monthlyCommitment) }
    if (asset.type === 'vehicle') return { ...md, plate, installmentCents: parseMoneyInput(installment) }
    if (asset.type === 'other') return { ...md, notes }
    return md
  }

  async function save() {
    setBusy(true)
    setError(null)
    const res = await updateAsset({ id: asset.id, name, metadata: buildMetadata() })
    setBusy(false)
    if (!res.ok) { setError(res.error ?? 'save_failed'); return }
    router.push(`/assets/${asset.id}`)
  }

  async function toggleStatus() {
    setBusy(true)
    setError(null)
    const res = await setAssetStatus({ id: asset.id, status: asset.status === 'active' ? 'closed' : 'active' })
    setBusy(false)
    if (!res.ok) { setError('save_failed'); return }
    router.push(`/assets/${asset.id}`)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[var(--paper)]">
      <div className="mx-auto flex min-h-full max-w-[430px] flex-col px-[18px] pb-6 pt-4">
        <div className="flex items-center justify-between py-2">
          <Link href={`/assets/${asset.id}`} aria-label={t('common.back')}
            className="pressable-opacity grid h-11 w-11 place-items-center text-2xl text-[var(--muted)]">‹</Link>
          <h1 className="text-base font-bold text-[var(--ink-head)]">{t('assets.editAsset')}</h1>
          <div className="h-11 w-11" />
        </div>

        <div className="flex flex-1 flex-col gap-3 pt-2">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-[var(--muted)]">{t('assets.name')}</span>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--ink)] outline-none" />
          </label>

          {asset.type === 'property' && (
            <>
              <TextField label={t('assets.field.address')} value={address} onChange={setAddress} />
              <MoneyField label={t('assets.field.monthlyCommitment')} value={monthlyCommitment} onChange={setMonthlyCommitment} />
            </>
          )}
          {asset.type === 'vehicle' && (
            <>
              <TextField label={t('assets.field.plate')} value={plate} onChange={setPlate} />
              <MoneyField label={t('assets.field.installment')} value={installment} onChange={setInstallment} />
            </>
          )}
          {asset.type === 'other' && <TextField label={t('assets.field.notes')} value={notes} onChange={setNotes} />}

          {error && <p role="alert" className="text-sm font-semibold text-[var(--danger)]">{t(`error.${error}`)}</p>}

          <div className="flex-1" />

          <button type="button" onClick={save} disabled={busy || !name.trim()} aria-busy={busy}
            className="pressable flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary-btn)] py-3 text-sm font-bold text-white disabled:opacity-40">
            {busy && <Spinner />}
            {t('asset.form.saveChanges')}
          </button>
          <button type="button" onClick={toggleStatus} disabled={busy}
            className="pressable min-h-[44px] w-full rounded-xl border border-[var(--hairline)] py-3 text-sm font-bold text-[var(--muted)] disabled:opacity-40">
            {asset.status === 'active' ? t('assets.close') : t('assets.reopen')}
          </button>
        </div>
      </div>
    </div>
  )
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-semibold text-[var(--muted)]">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--ink)] outline-none placeholder:text-[var(--faint)]" />
    </label>
  )
}

function MoneyField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-semibold text-[var(--muted)]">{label}</span>
      <div className="flex items-center gap-2 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3">
        <span className="text-sm font-semibold text-[var(--muted)]">RM</span>
        <input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} placeholder="0.00"
          className="flex-1 bg-transparent text-base text-[var(--ink)] outline-none placeholder:text-[var(--faint)]" />
      </div>
    </label>
  )
}
```

- [ ] **Step 8: Add an edit link + closed banner to the asset detail header**

In `src/app/(app)/assets/[id]/page.tsx`:

1. Add imports:

```tsx
import { Pencil } from 'lucide-react'
```

(`Link`, `t`, `StatusChip` note: `StatusChip` not needed here.)

2. Replace the `<header>` block to add the edit link and show a closed chip:

```tsx
      <header className="flex items-center gap-3">
        <Link
          href="/assets"
          aria-label={t(locale, 'common.back')}
          className="pressable-opacity grid h-11 w-11 shrink-0 place-items-center text-2xl text-[var(--muted)]"
        >
          ‹
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-extrabold text-[var(--ink-head)]">{asset.name}</h1>
          <p className="truncate text-xs font-semibold text-[var(--muted)]">
            {t(locale, `assets.type.${asset.type}`)}
            {asset.status === 'closed' ? ` · ${t(locale, 'status.closed')}` : ''}
          </p>
        </div>
        <Link
          href={`/assets/${asset.id}/edit`}
          aria-label={t(locale, 'assets.editAsset')}
          className="pressable-opacity grid h-11 w-11 shrink-0 place-items-center text-[var(--muted)]"
        >
          <Pencil size={18} />
        </Link>
      </header>
```

- [ ] **Step 9: Dim + collapse closed assets in the list**

In `src/app/(app)/assets/page.tsx`:

1. Add imports:

```tsx
import { splitByStatus } from '@/lib/data/assets-shared'
```

2. In `AssetsPage`, after computing `groups`, split each group into active/closed and gather all closed for a separate collapsed section. Replace the render body (`groups.length === 0 ? ... : (...)`) with:

```tsx
  const activeGroups = groups
    .map((g) => ({ type: g.type, assets: splitByStatus(g.assets).active }))
    .filter((g) => g.assets.length > 0)
  const closedAssets = groups.flatMap((g) => splitByStatus(g.assets).closed)

  return (
    <div className="flex flex-col gap-5 pb-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-[var(--ink-head)]">{t(locale, 'assets.title')}</h1>
        <Link
          href="/assets/new"
          className="pressable flex min-h-[44px] items-center gap-1 rounded-full bg-[var(--primary-btn)] px-4 py-2 text-sm font-bold text-white"
        >
          <Plus size={16} strokeWidth={2.5} />
          {t(locale, 'assets.add')}
        </Link>
      </header>

      {activeGroups.length === 0 && closedAssets.length === 0 ? (
        <p className="py-10 text-center text-sm font-semibold text-[var(--faint)]">{t(locale, 'assets.empty')}</p>
      ) : (
        <div className="flex flex-col gap-5">
          {activeGroups.map((g) => (
            <div key={g.type} className="flex flex-col gap-2">
              <span className="px-1 text-xs font-bold tracking-wide text-[var(--muted)] uppercase">
                {t(locale, `assets.type.${g.type}`)}
              </span>
              <div className="flex flex-col gap-2">
                {g.assets.map((a) => (
                  <AssetCard key={a.id} asset={a} locale={locale} />
                ))}
              </div>
            </div>
          ))}

          {closedAssets.length > 0 && <ClosedAssets assets={closedAssets} locale={locale} />}
        </div>
      )}
    </div>
  )
}
```

3. Add a `ClosedAssets` server component and make `AssetCard` dim when closed. Append:

```tsx
function ClosedAssets({ assets, locale }: { assets: (Asset & { key: KeyFigure })[]; locale: 'en' | 'zh' }) {
  return (
    <details className="flex flex-col gap-2">
      <summary className="cursor-pointer list-none px-1 text-xs font-bold tracking-wide text-[var(--muted)] uppercase">
        {t(locale, 'status.closed')} · {assets.length}
      </summary>
      <div className="mt-2 flex flex-col gap-2 opacity-60">
        {assets.map((a) => (
          <AssetCard key={a.id} asset={a} locale={locale} />
        ))}
      </div>
    </details>
  )
}
```

(`Asset` and `KeyFigure` are already imported at the top of the file; `AssetCard` already exists.)

- [ ] **Step 10: Add dictionary keys (both languages)**

`en`:

```ts
    'assets.editAsset': 'Edit asset',
    'assets.close': 'Close asset',
    'assets.reopen': 'Reopen asset',
```

`zh`:

```ts
    'assets.editAsset': '编辑资产',
    'assets.close': '关闭资产',
    'assets.reopen': '重新开启',
```

(`status.closed` already exists in both languages.)

- [ ] **Step 11: Verify**

Run: `npx vitest run src/lib/data/assets-shared.test.ts && npm run lint`
Expected: tests PASS, lint clean. Manually: open an asset, tap the pencil, rename it + edit metadata, Save; close it, confirm it moves to the dimmed collapsed "Closed" section in the list; reopen it, confirm it returns to its type group.

- [ ] **Step 12: Commit**

```bash
git add src/lib/data/assets-shared.ts src/lib/data/assets-shared.test.ts src/app/(app)/assets/actions.ts "src/app/(app)/assets/[id]/edit" src/app/(app)/assets/[id]/page.tsx src/app/(app)/assets/page.tsx src/i18n/dictionaries.ts
git commit -m "feat(assets): close/reopen, edit name & metadata, dim closed in list"
```

---

## Self-Review

**1. Spec coverage (Phase 7 items §3):**
- Item 1 — Edit expense (date, vendor, location, category, paid_by, amount, note) + same fields on Add with default-today date picker and collapsible "more": Tasks 1–3. ✅
- Item 2 — Edit/delete personal ledger entries: Task 4. Edit/delete asset transactions: Task 5. ✅
- Item 3 — Manage budget categories & commitments (add/edit/delete/reorder): Task 6 (incl. required `monthly_commitments.sort_order` SQL). Edit joint-fund config (expected monthly + carry-forward per member): Task 7. ✅
- Item 4 — Close/reopen assets + edit name/metadata + closed shown collapsed/dimmed: Task 8. ✅
- User decisions honored: expense categories stay the fixed enum, **not** linked to budget categories (Global Constraints); no settle-up feature anywhere. ✅
- Schema: only the one genuinely-missing column (`monthly_commitments.sort_order`) is added, via a manual SQL snippet per CLAUDE.md; everything else uses existing columns. ✅

**2. Placeholder scan:** No `TBD`/`TODO`/"handle edge cases"/"similar to Task N". Every code step contains complete code; every test step contains full test bodies; commands include expected outcomes. UI-only tasks (2, 3, 7) that have no vitest surface use `npm run lint` + explicit manual verification rather than a fake unit test, consistent with the codebase (no component tests exist).

**3. Type consistency:** `ExpenseInput`/`validateExpenseInput`/`parseExpenseForm` (Task 1) are consumed with identical signatures in Tasks 2–3. `ExpenseRow` gains `location` in Task 1 and is read in Task 3's edit form. `LedgerInput`/`validateLedgerInput` (Task 4), `TxnInput`/`validateTxnInput` (Task 5), `moveItem`/`CategoryRow`/`CommitmentRow` (Task 6), `FundConfig` (Task 7), and `splitByStatus` (Task 8) are all defined before use, and action signatures match their client call sites. Action return shapes follow the codebase's two conventions (form-submit → `redirect`; client-invoked → `{ ok, error? }`). `error.invalid_name` is newly added in Task 6 (it was referenced but absent from the dictionary before Phase 7).

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-07-05-phase-7-full-crud.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**

> **Before Task 6 is verified**, the user must paste `supabase/migrations/0003_commitment_sort.sql` into the Supabase SQL editor (no migration runner exists in this repo).
