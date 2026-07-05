# Phase 8 — Expense Data Quality (Triage: categorize + backfill paid_by) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fast one-card-at-a-time triage flow that sweeps every expense missing a `category` and/or `paid_by`, letting the user assign both with minimal taps, with an entry-point banner on the Expenses screen that appears only while un-triaged rows exist.

**Architecture:** Follow the repo's data-layer split. Pure, framework-free triage logic (predicate, count, validation) goes in `src/lib/data/triage-shared.ts` and is TDD-tested with vitest. Server-only Supabase reads/writes (`listExpensesNeedingTriage`, `countExpensesNeedingTriage`, `setExpenseCategoryPaidBy`) are added to the existing `src/lib/data/expenses.ts`, always household-scoped via `getMembership()`. A new route `(app)/expenses/triage` renders a client `TriageView` that walks the queue and calls a `'use server'` action returning `{ ok, error? }`. The Expenses page gains a count query and passes it to `ExpensesView`, which shows the banner.

**Tech Stack:** Next.js 16 App Router · React 19 · Tailwind 4 · Supabase (anon client, RLS) · vitest + jsdom · lucide-react.

## Global Constraints

- **Next.js 16 with breaking changes** — read `node_modules/next/dist/docs/` before writing Next.js code; heed deprecation notices.
- **No schema changes.** `expenses.category text` and `expenses.paid_by text check (paid_by in ('CH','JC'))` already exist (`supabase/migrations/0001_schema.sql:70,72`) and are NULL on the 81 imported rows.
- **Do NOT link expense categories to budget categories** (user decision, spec §4 Q2). Expense categories stay the fixed enum in `src/lib/categories.ts`. Leave `expenseKeysForBudget` untouched.
- **No settle-up feature** (user decision, spec §4 Q3).
- **All money is integer cents** (`number` in TS); format for display only with `MoneyText` / `formatRM`. Never floats.
- **Household scoping is a DB guarantee via RLS** — always query through the anon `createClient()` from `@/lib/supabase/server` and always filter by `householdId` from `getMembership()`.
- **Data-layer split:** pure/testable logic in `<domain>-shared.ts` (no `next/headers`, no Supabase); server reads/writes in `<domain>.ts`. Server modules re-export shared helpers for convenience.
- **Client-invoked server actions** are `'use server'`, return `{ ok, error? }` (NOT redirect — these are called from client handlers), and `revalidatePath(...)` affected screens.
- **i18n:** every new UI string goes through `t(locale, key)` and MUST be added to BOTH `en` and `zh` in `src/i18n/dictionaries.ts`. Our `t()` takes no interpolation params — compose multi-part strings from separate keys in the component.
- **UI conventions:** primitives from `src/components/ui/` (`MemberAvatar`, `MoneyText`, `IconTile`, `SubmitButton`, `Spinner`); tappable controls `min-h-[44px]`; `pressable` / `pressable-opacity` classes; colors via CSS custom properties (`var(--surface)`, `var(--primary)`, `var(--muted)`, `var(--member-ch)`, `var(--member-jc)`, etc.); icons via lucide-react through `IconTile`.
- The `@/` alias maps to `src/`. Tests are colocated `*.test.ts`; run with `npx vitest run <file>`.

---

### Task 1: Pure triage logic (`triage-shared.ts`) + category-key guard

**Files:**
- Modify: `src/lib/categories.ts` (add `isCategoryKey`)
- Create: `src/lib/data/triage-shared.ts`
- Test: `src/lib/data/triage-shared.test.ts`

**Interfaces:**
- Consumes: `CategoryKey`, `CATEGORIES` from `@/lib/categories`; `ExpenseRow`, `Member` from `./types`.
- Produces:
  - `isCategoryKey(k: string): k is CategoryKey` (in `@/lib/categories`)
  - `type TriageInput = { category: string | null; paidBy: Member | null }`
  - `needsTriage(row: Pick<ExpenseRow, 'category' | 'paid_by'>): boolean`
  - `countNeedingTriage(rows: Pick<ExpenseRow, 'category' | 'paid_by'>[]): number`
  - `validateTriageInput(input: TriageInput): { ok: true } | { ok: false; error: string }` — errors: `'invalid_category'`, `'invalid_member'`. Requires BOTH fields set (triage resolves both at once); `'uncategorized'` is rejected because it is not a real `CategoryKey`.

- [ ] **Step 1: Add `isCategoryKey` to `src/lib/categories.ts`**

Append after the `categoryLabel` function (end of file):

```typescript
const CATEGORY_KEY_SET: ReadonlySet<string> = new Set(CATEGORIES.map((c) => c.key))

// True only for the fixed expense categories (excludes 'uncategorized', which is a
// display-only fallback, not an assignable category).
export function isCategoryKey(k: string): k is CategoryKey {
  return CATEGORY_KEY_SET.has(k)
}
```

- [ ] **Step 2: Write the failing test**

Create `src/lib/data/triage-shared.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { needsTriage, countNeedingTriage, validateTriageInput, type TriageInput } from './triage-shared'
import { isCategoryKey } from '@/lib/categories'

describe('isCategoryKey', () => {
  it('accepts real category keys and rejects everything else', () => {
    expect(isCategoryKey('food')).toBe(true)
    expect(isCategoryKey('health')).toBe(true)
    expect(isCategoryKey('uncategorized')).toBe(false)
    expect(isCategoryKey('nope')).toBe(false)
  })
})

describe('needsTriage', () => {
  it('is true when category OR paid_by is missing', () => {
    expect(needsTriage({ category: null, paid_by: 'CH' })).toBe(true)
    expect(needsTriage({ category: 'food', paid_by: null })).toBe(true)
    expect(needsTriage({ category: null, paid_by: null })).toBe(true)
  })
  it('is false when both are present', () => {
    expect(needsTriage({ category: 'food', paid_by: 'CH' })).toBe(false)
  })
})

describe('countNeedingTriage', () => {
  it('counts only rows missing category or paid_by', () => {
    const rows = [
      { category: 'food', paid_by: 'CH' as const },
      { category: null, paid_by: 'JC' as const },
      { category: 'health', paid_by: null },
      { category: null, paid_by: null },
    ]
    expect(countNeedingTriage(rows)).toBe(3)
  })
  it('is 0 for an empty list', () => {
    expect(countNeedingTriage([])).toBe(0)
  })
})

describe('validateTriageInput', () => {
  const ok: TriageInput = { category: 'groceries', paidBy: 'JC' }
  it('accepts a valid category + member', () => {
    expect(validateTriageInput(ok)).toEqual({ ok: true })
  })
  it('rejects a missing or unknown category', () => {
    expect(validateTriageInput({ ...ok, category: null })).toEqual({ ok: false, error: 'invalid_category' })
    expect(validateTriageInput({ ...ok, category: 'uncategorized' })).toEqual({ ok: false, error: 'invalid_category' })
    expect(validateTriageInput({ ...ok, category: 'bogus' })).toEqual({ ok: false, error: 'invalid_category' })
  })
  it('rejects a missing or invalid member', () => {
    expect(validateTriageInput({ ...ok, paidBy: null })).toEqual({ ok: false, error: 'invalid_member' })
    expect(validateTriageInput({ ...ok, paidBy: 'ZZ' as unknown as 'CH' })).toEqual({ ok: false, error: 'invalid_member' })
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/data/triage-shared.test.ts`
Expected: FAIL — cannot resolve `./triage-shared` (module does not exist yet).

- [ ] **Step 4: Write minimal implementation**

Create `src/lib/data/triage-shared.ts`:

```typescript
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/data/triage-shared.test.ts`
Expected: PASS (all cases green).

- [ ] **Step 6: Commit**

```bash
git add src/lib/categories.ts src/lib/data/triage-shared.ts src/lib/data/triage-shared.test.ts
git commit -m "feat(triage): pure triage predicate, count, and validation"
```

---

### Task 2: Data layer — fetch queue, count, and narrow update in `expenses.ts`

**Files:**
- Modify: `src/lib/data/expenses.ts`
- Test: verified by typecheck + lint (server Supabase functions are not unit-tested in this repo — the testable logic lives in `triage-shared.ts`, already covered in Task 1).

**Interfaces:**
- Consumes: `getMembership()` from `./household`; `createClient` from `@/lib/supabase/server`; `COLS`, `ExpenseRow` (already in file); `validateTriageInput`, `TriageInput` from `./triage-shared`.
- Produces (server-only):
  - `listExpensesNeedingTriage(): Promise<ExpenseRow[]>` — household-scoped, `category IS NULL OR paid_by IS NULL`, ordered by `date` ascending (oldest first, so the sweep is chronological).
  - `countExpensesNeedingTriage(): Promise<number>` — same filter, `count: 'exact', head: true`.
  - `setExpenseCategoryPaidBy(id: string, input: TriageInput): Promise<{ ok: true } | { ok: false; error: string }>` — validates then updates only the two columns.
  - Re-exports `validateTriageInput` and type `TriageInput`.

> **Design justification (spec §3.2 asked us to choose):** use a NARROW `setExpenseCategoryPaidBy` rather than wrapping Phase 7's `updateExpense(id, ExpenseInput)`. The triage card shows date/vendor/details/amount read-only and edits only `category` + `paid_by`. Reusing `updateExpense` would force the client to round-trip `amount_cents`, `date`, `vendor`, `location`, `details` just to preserve them — risking clobbering good data and re-running amount/date validation that is irrelevant here. A two-column update is safer, lighter, and matches "lightweight update action."

- [ ] **Step 1: Add the imports and re-exports**

In `src/lib/data/expenses.ts`, extend the existing shared import (line 5) and re-export block (lines 7-9):

Change:
```typescript
import { validateExpenseInput, type ExpenseInput } from './expenses-shared'

// Re-exported for convenience; client components should import from './expenses-shared'.
export { validateExpenseInput }
export type { ExpenseInput }
```
to:
```typescript
import { validateExpenseInput, type ExpenseInput } from './expenses-shared'
import { validateTriageInput, type TriageInput } from './triage-shared'

// Re-exported for convenience; client components should import from the -shared modules.
export { validateExpenseInput, validateTriageInput }
export type { ExpenseInput, TriageInput }
```

- [ ] **Step 2: Add the three server functions**

Append at the end of `src/lib/data/expenses.ts` (after `deleteExpense`):

```typescript
export async function listExpensesNeedingTriage(): Promise<ExpenseRow[]> {
  const m = await getMembership()
  if (!m) return []
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('expenses')
    .select(COLS)
    .eq('household_id', m.householdId)
    .or('category.is.null,paid_by.is.null')
    .order('date', { ascending: true })
  if (error) { console.error('listExpensesNeedingTriage failed:', error.message); return [] }
  return (data ?? []) as ExpenseRow[]
}

export async function countExpensesNeedingTriage(): Promise<number> {
  const m = await getMembership()
  if (!m) return 0
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('expenses')
    .select('id', { count: 'exact', head: true })
    .eq('household_id', m.householdId)
    .or('category.is.null,paid_by.is.null')
  if (error) { console.error('countExpensesNeedingTriage failed:', error.message); return 0 }
  return count ?? 0
}

export async function setExpenseCategoryPaidBy(
  id: string,
  input: TriageInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }
  const valid = validateTriageInput(input)
  if (!valid.ok) return valid
  const supabase = await createClient()
  const { error } = await supabase
    .from('expenses')
    .update({ category: input.category, paid_by: input.paidBy })
    .eq('id', id)
    .eq('household_id', m.householdId)
  if (error) { console.error('setExpenseCategoryPaidBy failed:', error.message); return { ok: false, error: 'save_failed' } }
  return { ok: true }
}
```

- [ ] **Step 3: Verify typecheck + lint pass**

Run: `npx tsc --noEmit` then `npm run lint`
Expected: no errors introduced by these functions.

- [ ] **Step 4: Verify existing tests still pass**

Run: `npm test`
Expected: PASS (no regressions; the `expenses-shared` and `triage-shared` suites are green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/expenses.ts
git commit -m "feat(triage): data-layer queue, count, and narrow category/paid_by update"
```

---

### Task 3: Triage server action + i18n strings

**Files:**
- Create: `src/app/(app)/expenses/triage/actions.ts`
- Modify: `src/i18n/dictionaries.ts` (add `error.invalid_category` + `triage.*` keys to BOTH `en` and `zh`)

**Interfaces:**
- Consumes: `setExpenseCategoryPaidBy` from `@/lib/data/expenses`; `revalidatePath` from `next/cache`.
- Produces: `setExpenseTriageAction(id: string, category: string, paidBy: 'CH' | 'JC'): Promise<{ ok: boolean; error?: string }>` — client-invoked; returns a result object (NOT a redirect) and revalidates `/expenses` and `/`.
- Produces i18n keys used by Tasks 4 & 5: `triage.title`, `triage.of`, `triage.needSorting`, `triage.category`, `triage.skip`, `triage.saveNext`, `triage.done`, `triage.doneDesc`, `triage.backToExpenses`, `error.invalid_category`.

- [ ] **Step 1: Create the server action**

Create `src/app/(app)/expenses/triage/actions.ts`:

```typescript
'use server'
import { setExpenseCategoryPaidBy } from '@/lib/data/expenses'
import { revalidatePath } from 'next/cache'

export async function setExpenseTriageAction(
  id: string,
  category: string,
  paidBy: 'CH' | 'JC',
): Promise<{ ok: boolean; error?: string }> {
  const res = await setExpenseCategoryPaidBy(id, { category, paidBy })
  if (!res.ok) return { ok: false, error: res.error }
  revalidatePath('/expenses')
  revalidatePath('/')
  return { ok: true }
}
```

- [ ] **Step 2: Add English strings**

In `src/i18n/dictionaries.ts`, inside the `en` object, add `error.invalid_category` next to the other `error.*` entries (e.g. after the `error.invalid_member` line):

```typescript
    'error.invalid_category': 'Choose a category',
```

Then add the triage block after the `edit.saveChanges` line (still inside `en`):

```typescript
    'triage.title': 'Sort expenses',
    'triage.of': 'of',
    'triage.needSorting': 'to sort',
    'triage.category': 'Category',
    'triage.skip': 'Skip',
    'triage.saveNext': 'Save & next',
    'triage.done': 'All sorted!',
    'triage.doneDesc': 'Every expense now has a category and payer.',
    'triage.backToExpenses': 'Back to expenses',
```

- [ ] **Step 3: Add Chinese strings**

In the `zh` object, add `error.invalid_category` after the `error.invalid_member` line:

```typescript
    'error.invalid_category': '请选择类别',
```

Then add the triage block after the `edit.saveChanges` line (inside `zh`):

```typescript
    'triage.title': '整理开支',
    'triage.of': '/',
    'triage.needSorting': '笔待整理',
    'triage.category': '类别',
    'triage.skip': '跳过',
    'triage.saveNext': '保存并继续',
    'triage.done': '全部整理完成！',
    'triage.doneDesc': '每笔开支现在都有类别和付款人。',
    'triage.backToExpenses': '返回开支',
```

- [ ] **Step 4: Verify typecheck + lint pass**

Run: `npx tsc --noEmit` then `npm run lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/expenses/triage/actions.ts" src/i18n/dictionaries.ts
git commit -m "feat(triage): server action + bilingual triage strings"
```

---

### Task 4: Triage route + `TriageView` sweep UI

**Files:**
- Create: `src/app/(app)/expenses/triage/page.tsx`
- Create: `src/app/(app)/expenses/triage/TriageView.tsx`

**Interfaces:**
- Consumes: `listExpensesNeedingTriage` from `@/lib/data/expenses`; `setExpenseTriageAction` from `./actions`; `ExpenseRow` from `@/lib/data/types`; `CATEGORIES`, `categoryLabel`, `type CategoryKey` from `@/lib/categories`; `MemberAvatar`, `MoneyText`, `Spinner` from `@/components/ui/*`; `useT`, `useLocale` from `@/i18n/LocaleProvider`.
- Produces: default-exported `TriagePage` (server component) and `TriageView({ items }: { items: ExpenseRow[] })` (client component). No new exports consumed by later tasks.

> **UX note (spec §3.1):** one card at a time (date · vendor · details · amount read-only), tap a category chip + a CH/JC toggle, then **Save & next** advances; a **Skip** button advances without saving; progress reads `"{index+1} of {total}"` with a thin bar. We use an explicit **Save & next** rather than pure auto-advance-on-second-tap so a mis-tap can be corrected before committing — still just one tap after the two selections. When the queue is exhausted, a "done" state links back to `/expenses`.

- [ ] **Step 1: Create the server page**

Create `src/app/(app)/expenses/triage/page.tsx`:

```typescript
import { listExpensesNeedingTriage } from '@/lib/data/expenses'
import { TriageView } from './TriageView'

export default async function TriagePage() {
  const items = await listExpensesNeedingTriage()
  return <TriageView items={items} />
}
```

- [ ] **Step 2: Create the `TriageView` client component**

Create `src/app/(app)/expenses/triage/TriageView.tsx`:

```typescript
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useT, useLocale } from '@/i18n/LocaleProvider'
import { CATEGORIES, categoryLabel, type CategoryKey } from '@/lib/categories'
import { MemberAvatar } from '@/components/ui/MemberAvatar'
import { MoneyText } from '@/components/ui/MoneyText'
import { Spinner } from '@/components/ui/Spinner'
import type { ExpenseRow } from '@/lib/data/types'
import { setExpenseTriageAction } from './actions'

const MEMBERS = ['CH', 'JC'] as const

export function TriageView({ items }: { items: ExpenseRow[] }) {
  const t = useT()
  const [index, setIndex] = useState(0)
  const total = items.length
  const current = items[index]

  function next() {
    setIndex((i) => i + 1)
  }

  if (!current) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <div className="text-5xl">🎉</div>
        <h1 className="text-2xl font-extrabold text-[var(--ink-head)]">{t('triage.done')}</h1>
        <p className="max-w-[280px] text-sm font-semibold text-[var(--muted)]">{t('triage.doneDesc')}</p>
        <Link
          href="/expenses"
          className="pressable mt-2 flex min-h-[44px] items-center rounded-xl bg-[var(--primary-btn)] px-6 font-bold text-white"
        >
          {t('triage.backToExpenses')}
        </Link>
      </div>
    )
  }

  const pct = Math.round((index / total) * 100)

  return (
    <div className="flex flex-col gap-5 pb-6">
      {/* header + progress */}
      <div className="flex items-center justify-between py-2">
        <Link
          href="/expenses"
          aria-label={t('common.close')}
          className="pressable-opacity grid h-11 w-11 place-items-center text-2xl text-[var(--muted)]"
        >
          ×
        </Link>
        <h1 className="text-base font-bold text-[var(--ink-head)]">{t('triage.title')}</h1>
        <span className="min-w-11 text-right text-sm font-bold text-[var(--muted)]">
          {index + 1} {t('triage.of')} {total}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--subtle)]">
        <div className="h-full rounded-full bg-[var(--primary)] transition-[width] duration-200" style={{ width: `${pct}%` }} />
      </div>

      <TriageCard key={current.id} row={current} onResolved={next} onSkip={next} />
    </div>
  )
}

function TriageCard({
  row,
  onResolved,
  onSkip,
}: {
  row: ExpenseRow
  onResolved: () => void
  onSkip: () => void
}) {
  const t = useT()
  const locale = useLocale()
  const [category, setCategory] = useState<CategoryKey | null>((row.category as CategoryKey | null) ?? null)
  const [payer, setPayer] = useState<'CH' | 'JC' | null>(row.paid_by)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)

  const dateLabel = new Date(row.date).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  const title = row.vendor || row.details || dateLabel

  async function confirm() {
    if (!category || !payer) return
    setSaving(true)
    setFailed(false)
    const res = await setExpenseTriageAction(row.id, category, payer)
    if (!res.ok) {
      setSaving(false)
      setFailed(true)
      return
    }
    onResolved()
  }

  return (
    <div className="flex flex-col gap-5">
      {/* read-only expense summary */}
      <div className="flex flex-col gap-2 rounded-[16px] bg-[var(--surface)] p-4 shadow-[0_3px_10px_oklch(0.5_0.05_45/.05)]">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 flex-1 truncate text-base font-bold text-[var(--ink)]">{title}</p>
          <MoneyText cents={row.amount_cents} className="shrink-0 text-lg font-extrabold text-[var(--ink-head)]" />
        </div>
        <p className="text-xs font-semibold text-[var(--muted)]">{dateLabel}</p>
        {row.details && row.details !== title && (
          <p className="truncate text-xs text-[var(--muted)]">{row.details}</p>
        )}
        {row.location && <p className="truncate text-xs text-[var(--faint)]">{row.location}</p>}
      </div>

      {/* who paid */}
      <div>
        <p className="mb-2 text-sm font-semibold text-[var(--muted)]">{t('add.whoPaid')}</p>
        <div className="flex gap-2">
          {MEMBERS.map((m) => {
            const selected = payer === m
            const memberColor = m === 'CH' ? 'var(--member-ch)' : 'var(--member-jc)'
            return (
              <button
                type="button"
                key={m}
                onClick={() => setPayer(m)}
                className="pressable flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 font-semibold"
                style={{
                  borderColor: selected ? memberColor : 'var(--hairline)',
                  background: selected ? memberColor : 'var(--surface)',
                  color: selected ? 'white' : 'var(--ink)',
                }}
              >
                <MemberAvatar member={m} size={24} />
                {m}
              </button>
            )
          })}
        </div>
      </div>

      {/* category */}
      <div>
        <p className="mb-2 text-sm font-semibold text-[var(--muted)]">{t('triage.category')}</p>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => {
            const selected = category === c.key
            return (
              <button
                type="button"
                key={c.key}
                onClick={() => setCategory(c.key)}
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
      </div>

      {failed && <p className="text-sm font-semibold text-[var(--danger)]">{t('error.save_failed')}</p>}

      {/* actions */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onSkip}
          disabled={saving}
          className="pressable flex min-h-[44px] items-center justify-center rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-6 font-bold text-[var(--muted)] disabled:opacity-40"
        >
          {t('triage.skip')}
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={saving || !category || !payer}
          aria-busy={saving}
          className="pressable relative flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-[var(--primary-btn)] font-bold text-white disabled:opacity-40"
        >
          <span className="transition-opacity" style={{ opacity: saving ? 0 : 1 }}>
            {t('triage.saveNext')}
          </span>
          {saving && (
            <span className="absolute inset-0 flex items-center justify-center">
              <Spinner />
            </span>
          )}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify typecheck + lint pass**

Run: `npx tsc --noEmit` then `npm run lint`
Expected: no errors.

- [ ] **Step 4: Verify the build compiles the new route**

Run: `npm run build`
Expected: build succeeds and lists `/expenses/triage` among the compiled routes.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/expenses/triage/page.tsx" "src/app/(app)/expenses/triage/TriageView.tsx"
git commit -m "feat(triage): triage route and one-card sweep UI"
```

---

### Task 5: Entry-point banner on the Expenses screen

**Files:**
- Modify: `src/app/(app)/expenses/page.tsx` (fetch count, pass prop)
- Modify: `src/app/(app)/expenses/ExpensesView.tsx` (accept `triageCount`, render banner)

**Interfaces:**
- Consumes: `countExpensesNeedingTriage` from `@/lib/data/expenses`; `Link` from `next/link`; the `triage.needSorting` i18n key from Task 3.
- Produces: `ExpensesView` gains a required prop `triageCount: number`. Banner is a `Link` to `/expenses/triage`, rendered only when `triageCount > 0`.

- [ ] **Step 1: Fetch the count on the page and pass it down**

In `src/app/(app)/expenses/page.tsx`, add the import and extend the `Promise.all`, then pass the prop.

Change the import line:
```typescript
import { listExpenses, getMonthTotalCents } from '@/lib/data/expenses'
```
to:
```typescript
import { listExpenses, getMonthTotalCents, countExpensesNeedingTriage } from '@/lib/data/expenses'
```

Change the `Promise.all` block:
```typescript
  const [rows, totalCents] = await Promise.all([
    listExpenses({ year, month }),
    getMonthTotalCents(year, month),
  ])
```
to:
```typescript
  const [rows, totalCents, triageCount] = await Promise.all([
    listExpenses({ year, month }),
    getMonthTotalCents(year, month),
    countExpensesNeedingTriage(),
  ])
```

Change the JSX return to pass the prop:
```typescript
    <ExpensesView
      rows={rows}
      totalCents={totalCents}
      year={year}
      month={month}
      todayISO={todayISO}
      triageCount={triageCount}
    />
```

- [ ] **Step 2: Add the prop and banner to `ExpensesView`**

In `src/app/(app)/expenses/ExpensesView.tsx`:

Add the `next/link` import after the existing `next/navigation` import (line 4):
```typescript
import Link from 'next/link'
```

Extend the `Props` type (add `triageCount`):
```typescript
type Props = {
  rows: ExpenseRow[]
  totalCents: number
  year: number
  month: number
  todayISO: string
  triageCount: number
}
```

Update the component signature:
```typescript
export function ExpensesView({ rows, totalCents, year, month, todayISO, triageCount }: Props) {
```

Add the banner directly after the `<h1>…</h1>` title (before the `deleteFailed` alert block):
```tsx
      {triageCount > 0 && (
        <Link
          href="/expenses/triage"
          className="pressable flex min-h-[44px] items-center justify-between gap-2 rounded-full bg-[var(--pending-bg)] px-4 py-2.5 text-sm font-bold text-[var(--pending-text)]"
        >
          <span>
            {triageCount} {t('triage.needSorting')}
          </span>
          <span aria-hidden className="text-base">›</span>
        </Link>
      )}
```

- [ ] **Step 3: Verify typecheck + lint pass**

Run: `npx tsc --noEmit` then `npm run lint`
Expected: no errors (the new required prop is supplied by `page.tsx`).

- [ ] **Step 4: Verify build + full test suite**

Run: `npm run build` then `npm test`
Expected: build succeeds; all tests pass.

- [ ] **Step 5: Manual smoke check (documented, run if a dev server is available)**

Run: `npm run dev`, log in, open `/expenses`.
Expected: while any expense has NULL `category` or `paid_by`, a peach banner shows `"{n} to sort"`; tapping it opens `/expenses/triage`; assigning a category + payer and tapping **Save & next** advances and the row leaves the queue; **Skip** advances without saving; finishing the queue shows the "All sorted!" state; the banner count drops as rows are resolved (revalidated).

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/expenses/page.tsx" "src/app/(app)/expenses/ExpensesView.tsx"
git commit -m "feat(triage): entry-point banner on Expenses screen"
```

---

## Self-Review

**1. Spec coverage (§3 Phase 8, refined by §4 user decisions):**
- Triage UI, one card at a time, date/vendor/details/amount shown, category chip + CH/JC toggle, skip, progress "X of N" → **Task 4** (`TriageView` / `TriageCard`).
- Entry point on `/expenses` visible only when un-triaged rows exist, with count → **Task 5** (banner) + `countExpensesNeedingTriage` in **Task 2**.
- Data layer: fetch queue household-scoped ordered by date + lightweight update → **Task 2** (`listExpensesNeedingTriage`, `setExpenseCategoryPaidBy`); narrow-action choice justified.
- Do NOT link expense↔budget categories → honored: `expenseKeysForBudget` untouched, no `budget_category_id`; categories stay the fixed enum. Stated in Global Constraints.
- No settle-up → honored: nothing added. Stated in Global Constraints.
- No schema changes → honored: only existing `category` / `paid_by` columns written; verified against `0001_schema.sql:70,72`.
- Backfill `paid_by` → achieved by the same card assigning `paid_by`.

**2. Placeholder scan:** No TBD/TODO/"add validation"/"similar to Task N". Every code step shows complete code; every test step shows full assertions. Error copy is concrete in both locales.

**3. Type consistency:**
- `TriageInput = { category: string | null; paidBy: Member | null }` — defined in Task 1, consumed identically in Tasks 2 & 3.
- `validateTriageInput` return shape `{ ok: true } | { ok: false; error: string }` matches its use in `setExpenseCategoryPaidBy` (Task 2).
- `setExpenseCategoryPaidBy(id, input)` (Task 2) ← called by `setExpenseTriageAction(id, category, paidBy)` (Task 3) which builds `{ category, paidBy }`.
- `setExpenseTriageAction(id, category, paidBy) → { ok, error? }` (Task 3) ← called in `TriageCard.confirm` (Task 4) with `(row.id, category, payer)`; `payer` narrowed to `'CH' | 'JC'` by the `!category || !payer` guard.
- `ExpensesView` prop `triageCount: number` (Task 5) supplied by `page.tsx` (Task 5).
- `isCategoryKey` (Task 1, `categories.ts`) imported by `triage-shared.ts` (Task 1) and exercised in its test.
- Error keys `error.invalid_category` / `error.invalid_member` / `error.save_failed` all exist in both dictionaries after Task 3 (`invalid_member` and `save_failed` pre-exist).

All consistent. No gaps found.
