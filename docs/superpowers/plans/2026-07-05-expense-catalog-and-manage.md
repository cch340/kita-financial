# Expense Catalog (managed Category / Vendor / Location) + Manage tab + Filter — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded expense category list with household-managed Category / Vendor / Location lists (FK-linked from expenses), reachable and editable via a new More → Manage area, plus a unified Filter sheet and a reworked Add/Edit form.

**Architecture:** Three identical household-scoped tables (`expense_categories`, `vendors`, `locations`), each linked from `expenses` by a nullable FK with `ON DELETE SET NULL`. Data access is three thin per-kind server modules over one pure `catalog-shared.ts` (so category can later grow columns without touching vendor/location). UI: new `/more` + `/manage` screens, a reusable `Combobox`, reworked Add/Edit forms, and a Filter sheet on the expenses list.

**Tech Stack:** Next.js 16 App Router · React 19 · Tailwind 4 · Supabase (Postgres + RLS) · vitest + jsdom · lucide-react.

**Spec:** `docs/superpowers/specs/2026-07-05-expense-catalog-and-manage-design.md`

## Global Constraints

- **Next.js 16 breaking changes** — read `node_modules/next/dist/docs/` before writing Next.js code; `searchParams`/`params` are Promises (await them).
- **All money is integer cents** (`number` in TS, `bigint` in Postgres). Never floats.
- **Every query is household-scoped** via `getMembership()` and runs through the anon `createClient()` (`@/lib/supabase/server`) so RLS applies. Never use the admin client here.
- **Pure logic goes in `-shared.ts`** (no `next/headers`, no supabase); client components and vitest import those.
- **Catalog item names are single free-text** — no `name_en`/`name_zh`, no icon/color. One `name` column.
- **`@/` alias maps to `src/`.** Tests are `*.test.ts` colocated beside code; run with `npx vitest run <file>`.
- **Server Actions** parse `FormData`, call a data-layer function, `revalidatePath(...)`, then `redirect(...)`; errors surface via `?error=` redirects.
- **UI uses CSS custom properties** (`var(--primary)`, `var(--surface)`, `var(--hairline)`, `var(--ink)`, `var(--muted)`, `var(--danger)`, etc.) and `lucide-react` icons.
- Commit after every task. Commit messages end with:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

## Phase A — Database & data layer

### Task 1: Migration — tables, RLS, FK columns, backfill, drop old text

**Files:**
- Create: `supabase/migrations/0005_expense_catalog.sql`
- Modify: `src/lib/data/types.ts` (ExpenseRow reshape)

**Interfaces:**
- Produces (DB): tables `expense_categories`, `vendors`, `locations` each `(id uuid pk, household_id uuid, name text, sort_order int, created_at timestamptz)`; `expenses.category_id / vendor_id / location_id uuid` nullable FKs `ON DELETE SET NULL`; old `expenses.vendor/location/category` columns dropped.
- Produces (TS): new `ExpenseRow` shape (below) consumed by every later task.

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/0005_expense_catalog.sql`:

```sql
-- === Expense catalog: user-managed Category / Vendor / Location ===
create table expense_categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create unique index expense_categories_name_ci on expense_categories (household_id, lower(name));

create table vendors (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create unique index vendors_name_ci on vendors (household_id, lower(name));

create table locations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create unique index locations_name_ci on locations (household_id, lower(name));

-- RLS: members get full CRUD, mirroring 0002_rls.sql
alter table expense_categories enable row level security;
alter table vendors            enable row level security;
alter table locations          enable row level security;
create policy ec_all  on expense_categories for all using (is_member(household_id)) with check (is_member(household_id));
create policy ven_all on vendors            for all using (is_member(household_id)) with check (is_member(household_id));
create policy loc_all on locations          for all using (is_member(household_id)) with check (is_member(household_id));

-- Link columns on expenses (nullable; unlink on delete)
alter table expenses
  add column category_id uuid references expense_categories(id) on delete set null,
  add column vendor_id   uuid references vendors(id)            on delete set null,
  add column location_id uuid references locations(id)          on delete set null;
create index expenses_household_category_idx on expenses (household_id, category_id);

-- Backfill vendors from distinct non-blank vendor text (skip '-')
insert into vendors (household_id, name)
  select distinct household_id, trim(vendor)
  from expenses
  where vendor is not null and trim(vendor) <> '' and trim(vendor) <> '-';
update expenses e set vendor_id = v.id
  from vendors v
  where v.household_id = e.household_id and lower(v.name) = lower(trim(e.vendor));

-- Backfill locations (treat '-' as no location)
insert into locations (household_id, name)
  select distinct household_id, trim(location)
  from expenses
  where location is not null and trim(location) <> '' and trim(location) <> '-';
update expenses e set location_id = l.id
  from locations l
  where l.household_id = e.household_id and lower(l.name) = lower(trim(e.location));

-- Category intentionally NOT seeded (Excel has none).

-- Drop replaced columns (Excel is the backup; keep `details` = the note)
alter table expenses drop column vendor, drop column location, drop column category;
```

- [ ] **Step 2: Reshape `ExpenseRow` in `src/lib/data/types.ts`**

Replace the `ExpenseRow` type (lines 2-11) with:

```typescript
export type ExpenseRow = {
  id: string
  date: string
  details: string | null
  amount_cents: number
  paid_by: Member | null
  category_id: string | null
  vendor_id: string | null
  location_id: string | null
  category_name: string | null
  vendor_name: string | null
  location_name: string | null
}
```

Leave `Member`, `DayGroup`, `Membership` unchanged.

- [ ] **Step 3: Sanity-check the migration SQL locally**

This project has no local Postgres; the migration is applied by hand in the Supabase SQL editor at deploy time. Verify by reading: every `create table` has RLS enabled + a policy; the two backfills run **before** the `drop column`; `details` is NOT dropped. No command to run.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0005_expense_catalog.sql src/lib/data/types.ts
git commit -m "feat(db): add expense catalog tables, FK links, backfill migration"
```

> ⚠️ **Deploy note (record in PR description, not code):** because columns are dropped, run `0005` in the Supabase SQL editor in the **same release** as this code. Verify backfill counts (`select count(*) from vendors;` etc.) before the `drop column` lines if applying interactively.

---

### Task 2: `catalog-shared.ts` — pure helpers (TDD)

**Files:**
- Create: `src/lib/data/catalog-shared.ts`
- Test: `src/lib/data/catalog-shared.test.ts`

**Interfaces:**
- Produces: `type CatalogItem = { id: string; name: string; sort_order: number }`; `normalizeName(raw: string): string`; `findCaseInsensitiveDuplicate(name: string, existing: CatalogItem[], exceptId?: string): CatalogItem | null`; `nextSortOrder(existing: CatalogItem[]): number`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/data/catalog-shared.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  normalizeName, findCaseInsensitiveDuplicate, nextSortOrder,
  type CatalogItem,
} from './catalog-shared'

const item = (id: string, name: string, sort_order = 0): CatalogItem => ({ id, name, sort_order })

describe('normalizeName', () => {
  it('trims and collapses inner whitespace', () => {
    expect(normalizeName('  Jaya   Grocer  ')).toBe('Jaya Grocer')
    expect(normalizeName('Aeon')).toBe('Aeon')
  })
})

describe('findCaseInsensitiveDuplicate', () => {
  const existing = [item('1', 'Aeon'), item('2', 'Jaya Grocer')]
  it('matches ignoring case and surrounding space', () => {
    expect(findCaseInsensitiveDuplicate('  aeon ', existing)?.id).toBe('1')
    expect(findCaseInsensitiveDuplicate('AEON', existing)?.id).toBe('1')
  })
  it('returns null when no match', () => {
    expect(findCaseInsensitiveDuplicate('Lotus', existing)).toBeNull()
  })
  it('excludes a given id (for rename of self)', () => {
    expect(findCaseInsensitiveDuplicate('Aeon', existing, '1')).toBeNull()
  })
})

describe('nextSortOrder', () => {
  it('is 0 for empty, else max+1', () => {
    expect(nextSortOrder([])).toBe(0)
    expect(nextSortOrder([item('1', 'a', 0), item('2', 'b', 5)])).toBe(6)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/data/catalog-shared.test.ts`
Expected: FAIL — cannot resolve `./catalog-shared`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/data/catalog-shared.ts`:

```typescript
// Pure, server/client-safe catalog helpers — no supabase / next/headers here.
// Shared by the three per-kind modules (categories/vendors/locations) and their tests.
export type CatalogItem = { id: string; name: string; sort_order: number }

/** Trim and collapse internal runs of whitespace to a single space. */
export function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

/** Case-insensitive duplicate lookup (after normalize), optionally excluding one id. */
export function findCaseInsensitiveDuplicate(
  name: string, existing: CatalogItem[], exceptId?: string,
): CatalogItem | null {
  const key = normalizeName(name).toLowerCase()
  return existing.find((i) => i.id !== exceptId && normalizeName(i.name).toLowerCase() === key) ?? null
}

/** Next sort_order = max existing + 1, or 0 when empty. */
export function nextSortOrder(existing: CatalogItem[]): number {
  return existing.length === 0 ? 0 : Math.max(...existing.map((i) => i.sort_order)) + 1
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/data/catalog-shared.test.ts`
Expected: PASS (all 3 describe blocks).

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/catalog-shared.ts src/lib/data/catalog-shared.test.ts
git commit -m "feat(data): pure catalog-shared helpers with tests"
```

---

### Task 3: Thin per-kind data modules

**Files:**
- Create: `src/lib/data/categories.ts`
- Create: `src/lib/data/vendors.ts`
- Create: `src/lib/data/locations.ts`

**Interfaces:**
- Consumes: `catalog-shared` (`CatalogItem`, `normalizeName`, `findCaseInsensitiveDuplicate`, `nextSortOrder`), `createClient` (`@/lib/supabase/server`), `getMembership` (`./household`).
- Produces (categories.ts — vendors/locations identical with their own table/counter column):
  - `listCategories(): Promise<CatalogItem[]>`
  - `createCategory(name: string): Promise<{ ok: true; id: string } | { ok: false; error: 'duplicate' | 'invalid' | 'save_failed' }>`
  - `renameCategory(id: string, name: string): Promise<{ ok: true } | { ok: false; error: 'duplicate' | 'invalid' | 'save_failed' }>`
  - `deleteCategory(id: string): Promise<{ ok: boolean }>`
  - `countExpensesUsingCategory(id: string): Promise<number>` (column `category_id`; vendors → `vendor_id`, locations → `location_id`)

- [ ] **Step 1: Write `categories.ts`**

Create `src/lib/data/categories.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { getMembership } from './household'
import {
  normalizeName, findCaseInsensitiveDuplicate, nextSortOrder, type CatalogItem,
} from './catalog-shared'

const TABLE = 'expense_categories'
const EXPENSE_FK = 'category_id'

export async function listCategories(): Promise<CatalogItem[]> {
  const m = await getMembership()
  if (!m) return []
  const supabase = await createClient()
  const { data, error } = await supabase.from(TABLE)
    .select('id, name, sort_order').eq('household_id', m.householdId)
    .order('sort_order', { ascending: true })
  if (error) { console.error('listCategories failed:', error.message); return [] }
  return (data ?? []) as CatalogItem[]
}

export async function createCategory(
  name: string,
): Promise<{ ok: true; id: string } | { ok: false; error: 'duplicate' | 'invalid' | 'save_failed' }> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'save_failed' }
  const clean = normalizeName(name)
  if (!clean) return { ok: false, error: 'invalid' }
  const existing = await listCategories()
  if (findCaseInsensitiveDuplicate(clean, existing)) return { ok: false, error: 'duplicate' }
  const supabase = await createClient()
  const { data, error } = await supabase.from(TABLE)
    .insert({ household_id: m.householdId, name: clean, sort_order: nextSortOrder(existing) })
    .select('id').single()
  if (error || !data) {
    if (error?.code === '23505') return { ok: false, error: 'duplicate' } // unique index race
    console.error('createCategory failed:', error?.message)
    return { ok: false, error: 'save_failed' }
  }
  return { ok: true, id: data.id as string }
}

export async function renameCategory(
  id: string, name: string,
): Promise<{ ok: true } | { ok: false; error: 'duplicate' | 'invalid' | 'save_failed' }> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'save_failed' }
  const clean = normalizeName(name)
  if (!clean) return { ok: false, error: 'invalid' }
  const existing = await listCategories()
  if (findCaseInsensitiveDuplicate(clean, existing, id)) return { ok: false, error: 'duplicate' }
  const supabase = await createClient()
  const { error } = await supabase.from(TABLE)
    .update({ name: clean }).eq('id', id).eq('household_id', m.householdId)
  if (error) {
    if (error.code === '23505') return { ok: false, error: 'duplicate' }
    console.error('renameCategory failed:', error.message)
    return { ok: false, error: 'save_failed' }
  }
  return { ok: true }
}

export async function deleteCategory(id: string): Promise<{ ok: boolean }> {
  const m = await getMembership()
  if (!m) return { ok: false }
  const supabase = await createClient()
  const { error } = await supabase.from(TABLE).delete().eq('id', id).eq('household_id', m.householdId)
  if (error) { console.error('deleteCategory failed:', error.message); return { ok: false } }
  return { ok: true }
}

export async function countExpensesUsingCategory(id: string): Promise<number> {
  const m = await getMembership()
  if (!m) return 0
  const supabase = await createClient()
  const { count, error } = await supabase.from('expenses')
    .select('id', { count: 'exact', head: true })
    .eq('household_id', m.householdId).eq(EXPENSE_FK, id)
  if (error) { console.error('countExpensesUsingCategory failed:', error.message); return 0 }
  return count ?? 0
}
```

- [ ] **Step 2: Write `vendors.ts`**

Create `src/lib/data/vendors.ts` — copy `categories.ts` verbatim, then change: `TABLE = 'vendors'`, `EXPENSE_FK = 'vendor_id'`, and rename every exported function `…Category…` → `…Vendor…` (`listVendors`, `createVendor`, `renameVendor`, `deleteVendor`, `countExpensesUsingVendor`). Internal `listVendors()` calls replace `listCategories()`.

- [ ] **Step 3: Write `locations.ts`**

Create `src/lib/data/locations.ts` — same copy, with `TABLE = 'locations'`, `EXPENSE_FK = 'location_id'`, functions `listLocations`, `createLocation`, `renameLocation`, `deleteLocation`, `countExpensesUsingLocation`.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors in the three new files (there will still be errors elsewhere until later tasks — confirm none originate in `categories.ts`/`vendors.ts`/`locations.ts`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/categories.ts src/lib/data/vendors.ts src/lib/data/locations.ts
git commit -m "feat(data): thin per-kind category/vendor/location modules"
```

---

### Task 4: Rewire expense reads/writes to FK ids + joined names

**Files:**
- Modify: `src/lib/data/expenses-shared.ts` (full replace)
- Modify: `src/lib/data/expenses.ts` (COLS/select, mapper, insert/update, triage writer)
- Modify: `src/lib/data/expenses-shared.test.ts` if present (see Step 3)

**Interfaces:**
- Produces: `ExpenseInput = { dateISO; categoryId: string | null; vendorId: string | null; locationId: string | null; paidBy: Member | null; amountCents: number; note: string | null }`; `parseExpenseForm(fd)` reads `categoryId`/`vendorId`/`locationId`; `EXPENSE_SELECT` string + `mapExpenseRow(raw)` exported from `expenses.ts` for reuse by `report.ts`.

- [ ] **Step 1: Replace `expenses-shared.ts`**

Full new content of `src/lib/data/expenses-shared.ts`:

```typescript
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
```

- [ ] **Step 2: Update `expenses.ts`**

In `src/lib/data/expenses.ts`:

Replace the `COLS` constant (line 12) with an exported select + row mapper:

```typescript
// FK ids for editing/filtering + joined names for display.
export const EXPENSE_SELECT =
  'id, date, details, amount_cents, paid_by, category_id, vendor_id, location_id, ' +
  'category:expense_categories(name), vendor:vendors(name), location:locations(name)'

type RawExpense = {
  id: string; date: string; details: string | null; amount_cents: number; paid_by: Member | null
  category_id: string | null; vendor_id: string | null; location_id: string | null
  category: { name: string } | null; vendor: { name: string } | null; location: { name: string } | null
}

export function mapExpenseRow(r: RawExpense): ExpenseRow {
  return {
    id: r.id, date: r.date, details: r.details, amount_cents: r.amount_cents, paid_by: r.paid_by,
    category_id: r.category_id, vendor_id: r.vendor_id, location_id: r.location_id,
    category_name: r.category?.name ?? null,
    vendor_name: r.vendor?.name ?? null,
    location_name: r.location?.name ?? null,
  }
}
```

Add `Member` to the type import from `./types` and import `ExpenseRow` (already imported). Then, in each function, replace `.select(COLS)` with `.select(EXPENSE_SELECT)` and cast/map results through `mapExpenseRow`:

- `listExpenses`: `return (data ?? []).map((r) => mapExpenseRow(r as unknown as RawExpense))`
- `getExpense`: `return data ? mapExpenseRow(data as unknown as RawExpense) : null`
- `listExpensesNeedingTriage`: replace `.or('category.is.null,paid_by.is.null')` with `.or('category_id.is.null,paid_by.is.null')`; map rows via `mapExpenseRow`.
- `countExpensesNeedingTriage`: replace `.or('category.is.null,paid_by.is.null')` with `.or('category_id.is.null,paid_by.is.null')`.

Update `addExpense` insert object (was vendor/location/details/category) to:

```typescript
  const { error } = await supabase.from('expenses').insert({
    household_id: m.householdId,
    date: input.dateISO,
    details: input.note,
    category_id: input.categoryId,
    vendor_id: input.vendorId,
    location_id: input.locationId,
    amount_cents: input.amountCents,
    paid_by: input.paidBy,
    created_by: user?.id ?? null,
  })
```

Update `updateExpense` update object similarly:

```typescript
  const { error } = await supabase.from('expenses').update({
    date: input.dateISO,
    details: input.note,
    category_id: input.categoryId,
    vendor_id: input.vendorId,
    location_id: input.locationId,
    amount_cents: input.amountCents,
    paid_by: input.paidBy,
  }).eq('id', id).eq('household_id', m.householdId)
```

Update `setExpenseCategoryPaidBy` — its `TriageInput` now carries `categoryId` (see Task 5); change the update to:

```typescript
    .update({ category_id: input.categoryId, paid_by: input.paidBy })
```

- [ ] **Step 3: Update the expenses-shared test if it exists**

Run: `ls src/lib/data/expenses-shared.test.ts 2>/dev/null` — if present, open it and replace any `vendor`/`location`/`category` field references in the `parseExpenseForm` expectations with `categoryId`/`vendorId`/`locationId`, and set the FormData keys accordingly. If the file does not exist, skip.

- [ ] **Step 4: Typecheck the two files**

Run: `npx tsc --noEmit`
Expected: `expenses.ts` and `expenses-shared.ts` clean. (Triage/report/budget/UI still error — fixed in later tasks.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/expenses.ts src/lib/data/expenses-shared.ts
git commit -m "feat(data): expenses read/write via category/vendor/location ids"
```

---

### Task 5: Triage — category by id, load household categories

**Files:**
- Modify: `src/lib/data/triage-shared.ts`
- Modify: `src/lib/data/triage-shared.test.ts`
- Modify: `src/app/(app)/expenses/triage/page.tsx`
- Modify: `src/app/(app)/expenses/triage/TriageView.tsx`
- Modify: `src/app/(app)/expenses/triage/actions.ts`

**Interfaces:**
- Produces: `TriageInput = { categoryId: string | null; paidBy: Member | null }`; `needsTriage`/`countNeedingTriage` operate on `{ category_id, paid_by }`; `setExpenseTriageAction(id, categoryId, paidBy)`.

- [ ] **Step 1: Rewrite `triage-shared.ts`**

Full new content of `src/lib/data/triage-shared.ts`:

```typescript
// Pure, server/client-safe triage helpers and types — no supabase / next/headers here.
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
```

- [ ] **Step 2: Rewrite `triage-shared.test.ts`**

Full new content:

```typescript
import { describe, it, expect } from 'vitest'
import { needsTriage, countNeedingTriage, validateTriageInput, type TriageInput } from './triage-shared'

describe('needsTriage', () => {
  it('is true when category_id OR paid_by is missing', () => {
    expect(needsTriage({ category_id: null, paid_by: 'CH' })).toBe(true)
    expect(needsTriage({ category_id: 'c1', paid_by: null })).toBe(true)
    expect(needsTriage({ category_id: null, paid_by: null })).toBe(true)
  })
  it('is false when both are present', () => {
    expect(needsTriage({ category_id: 'c1', paid_by: 'CH' })).toBe(false)
  })
})

describe('countNeedingTriage', () => {
  it('counts only rows missing category_id or paid_by', () => {
    const rows = [
      { category_id: 'c1', paid_by: 'CH' as const },
      { category_id: null, paid_by: 'JC' as const },
      { category_id: 'c2', paid_by: null },
      { category_id: null, paid_by: null },
    ]
    expect(countNeedingTriage(rows)).toBe(3)
  })
  it('is 0 for an empty list', () => {
    expect(countNeedingTriage([])).toBe(0)
  })
})

describe('validateTriageInput', () => {
  const ok: TriageInput = { categoryId: 'c1', paidBy: 'JC' }
  it('accepts a non-empty category id + member', () => {
    expect(validateTriageInput(ok)).toEqual({ ok: true })
  })
  it('rejects a missing category', () => {
    expect(validateTriageInput({ ...ok, categoryId: null })).toEqual({ ok: false, error: 'invalid_category' })
    expect(validateTriageInput({ ...ok, categoryId: '' })).toEqual({ ok: false, error: 'invalid_category' })
  })
  it('rejects a missing or invalid member', () => {
    expect(validateTriageInput({ ...ok, paidBy: null })).toEqual({ ok: false, error: 'invalid_member' })
    expect(validateTriageInput({ ...ok, paidBy: 'ZZ' as unknown as 'CH' })).toEqual({ ok: false, error: 'invalid_member' })
  })
})
```

- [ ] **Step 3: Run the triage test**

Run: `npx vitest run src/lib/data/triage-shared.test.ts`
Expected: PASS.

- [ ] **Step 4: Update the triage page to load categories**

Replace `src/app/(app)/expenses/triage/page.tsx` body so it fetches categories and passes them. It currently loads items and renders `<TriageView items=... />`. Add:

```typescript
import { listExpensesNeedingTriage } from '@/lib/data/expenses'
import { listCategories } from '@/lib/data/categories'
import { TriageView } from './TriageView'

export default async function TriagePage() {
  const [items, categories] = await Promise.all([listExpensesNeedingTriage(), listCategories()])
  return <TriageView items={items} categories={categories} />
}
```

(Match the existing file's other imports/exports; only add `categories`.)

- [ ] **Step 5: Update `TriageView.tsx`**

- Remove `import { CATEGORIES, categoryLabel, type CategoryKey } from '@/lib/categories'`; add `import type { CatalogItem } from '@/lib/data/catalog-shared'`.
- Change `TriageView` signature to `{ items, categories }: { items: ExpenseRow[]; categories: CatalogItem[] }` and pass `categories` into `<TriageCard … categories={categories} />`.
- In `TriageCard`, change `useState<CategoryKey | null>(...)` to `useState<string | null>(row.category_id)`; accept `categories: CatalogItem[]` prop; render the category buttons from `categories.map((c) => …)` keyed by `c.id`, selected when `category === c.id`, label `c.name`, `onClick={() => setCategory(c.id)}`.
- `confirm()` calls `setExpenseTriageAction(row.id, category, payer)` (category is the id).
- `title` uses `row.vendor_name || row.details || dateLabel`; the location line uses `row.location_name`.
- If `categories.length === 0`, render a hint under the category heading: `t('triage.noCategories')` with a `<Link href="/manage">` — the user must create categories first.

- [ ] **Step 6: Update triage `actions.ts`**

`setExpenseTriageAction(id, categoryId, paidBy)` — rename the param and pass `{ categoryId, paidBy }`:

```typescript
export async function setExpenseTriageAction(
  id: string, categoryId: string, paidBy: 'CH' | 'JC',
): Promise<{ ok: boolean; error?: string }> {
  const res = await setExpenseCategoryPaidBy(id, { categoryId, paidBy })
  if (!res.ok) return { ok: false, error: res.error }
  revalidatePath('/expenses'); revalidatePath('/'); revalidatePath('/budget')
  return { ok: true }
}
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/data/triage-shared.ts src/lib/data/triage-shared.test.ts "src/app/(app)/expenses/triage"
git commit -m "feat(triage): assign category by id from household list"
```

---

### Task 6: Reports — group by category name

**Files:**
- Modify: `src/lib/data/report-shared.ts`
- Modify: `src/lib/data/report-shared.test.ts`
- Modify: `src/lib/data/report.ts`
- Modify: `src/app/(app)/report/ReportView.tsx`
- Modify: `src/app/(app)/report/export/route.ts`

**Interfaces:**
- Produces: `buildCategoryMonthMatrix(rows, year)` groups by `category_name`; `''` = uncategorized bucket, sorted last; category keys are display names.

- [ ] **Step 1: Rewrite the matrix builder in `report-shared.ts`**

Replace lines 1-40 (imports through end of `buildCategoryMonthMatrix`) with:

```typescript
// Pure, server/client-safe report aggregation — no supabase / next/headers here.
import type { ExpenseRow } from './types'
import type { LedgerEntry } from './personal-shared'

export type CategoryMonthMatrix = {
  categories: string[]          // display names; '' marks the uncategorized bucket, always last
  cells: Record<string, number[]>
  categoryTotals: Record<string, number>
  monthTotals: number[]
  grandTotalCents: number
}

export const UNCATEGORIZED = '' // sentinel key for rows with no category

export function buildCategoryMonthMatrix(rows: ExpenseRow[], year: number): CategoryMonthMatrix {
  const yearStr = String(year)
  const cells: Record<string, number[]> = {}
  for (const r of rows) {
    if (r.date.slice(0, 4) !== yearStr) continue
    const monthIndex = Number(r.date.slice(5, 7)) - 1
    if (monthIndex < 0 || monthIndex > 11) continue
    const key = r.category_name ?? UNCATEGORIZED
    ;(cells[key] ??= Array(12).fill(0))[monthIndex] += r.amount_cents
  }

  const named = Object.keys(cells).filter((k) => k !== UNCATEGORIZED).sort((a, b) => a.localeCompare(b))
  const categories = UNCATEGORIZED in cells ? [...named, UNCATEGORIZED] : named

  const categoryTotals: Record<string, number> = {}
  const monthTotals = Array(12).fill(0)
  for (const key of categories) {
    const row = cells[key]
    categoryTotals[key] = row.reduce((a, b) => a + b, 0)
    for (let i = 0; i < 12; i++) monthTotals[i] += row[i]
  }
  const grandTotalCents = monthTotals.reduce((a, b) => a + b, 0)
  return { categories, cells, categoryTotals, monthTotals, grandTotalCents }
}
```

Keep `personalBalanceTrend` unchanged below.

- [ ] **Step 2: Rewrite `report-shared.test.ts`**

Full new content:

```typescript
import { describe, it, expect } from 'vitest'
import { buildCategoryMonthMatrix, personalBalanceTrend, UNCATEGORIZED } from './report-shared'
import type { ExpenseRow } from './types'
import type { LedgerEntry } from './personal-shared'

const exp = (date: string, category_name: string | null, cents: number): ExpenseRow => ({
  id: 'x', date, details: null, amount_cents: cents, paid_by: null,
  category_id: category_name ? 'c' : null, vendor_id: null, location_id: null,
  category_name, vendor_name: null, location_name: null,
})

describe('buildCategoryMonthMatrix', () => {
  it('buckets expenses by category name and month', () => {
    const m = buildCategoryMonthMatrix(
      [exp('2026-01-05', 'Food', 1000), exp('2026-01-20', 'Food', 500), exp('2026-03-10', 'Transport', 2000)],
      2026,
    )
    expect(m.cells.Food[0]).toBe(1500)
    expect(m.cells.Transport[2]).toBe(2000)
    expect(m.categoryTotals.Food).toBe(1500)
    expect(m.monthTotals[0]).toBe(1500)
    expect(m.grandTotalCents).toBe(3500)
    expect(m.categories).toEqual(['Food', 'Transport']) // alphabetical
  })

  it('maps null category to the uncategorized bucket, ordered last', () => {
    const m = buildCategoryMonthMatrix(
      [exp('2025-01-05', 'Food', 9999), exp('2026-02-05', null, 700), exp('2026-02-06', 'Food', 300)],
      2026,
    )
    expect(m.cells.Food[1]).toBe(300)
    expect(m.cells[UNCATEGORIZED][1]).toBe(700)
    expect(m.categories).toEqual(['Food', UNCATEGORIZED])
    expect(m.grandTotalCents).toBe(1000)
  })

  it('returns empty structures when no rows match', () => {
    const m = buildCategoryMonthMatrix([], 2026)
    expect(m.categories).toEqual([])
    expect(m.grandTotalCents).toBe(0)
  })
})

describe('personalBalanceTrend', () => {
  const led = (period: string, entryType: 'income' | 'expense', cents: number): LedgerEntry => ({
    id: 'x', ownerMemberCode: 'CH', period, entryType, description: 'd', amountCents: cents, remark: null,
  })
  it('computes monthly income minus expense, ignoring other years', () => {
    const trend = personalBalanceTrend(
      [led('2026-01-01', 'income', 5000), led('2026-01-01', 'expense', 2000), led('2025-01-01', 'income', 9999)],
      2026,
    )
    expect(trend[0]).toBe(3000)
    expect(trend.length).toBe(12)
  })
})
```

- [ ] **Step 3: Run the report test**

Run: `npx vitest run src/lib/data/report-shared.test.ts`
Expected: PASS.

- [ ] **Step 4: Update `report.ts` to select joined names**

In `src/lib/data/report.ts`:
- Replace the `EXPENSE_COLS` constant (line 14) usage: import `EXPENSE_SELECT, mapExpenseRow` from `./expenses` and delete the local `EXPENSE_COLS`.
- In `getExpensesForYear`, change `.select(EXPENSE_COLS)` → `.select(EXPENSE_SELECT)` and `return (data ?? []) as ExpenseRow[]` → `return (data ?? []).map((r) => mapExpenseRow(r as never))`.

- [ ] **Step 5: Update `ReportView.tsx`**

- Remove `import { categoryLabel } from '@/lib/categories'`; import `{ UNCATEGORIZED } from '@/lib/data/report-shared'`.
- In the "By category" map (line ~102-110), replace `categoryLabel(key, locale)` with `key === UNCATEGORIZED ? t(locale, 'report.uncategorized') : key`.

- [ ] **Step 6: Update the export route**

In `src/app/(app)/report/export/route.ts`:
- Remove `import { categoryLabel } from '@/lib/categories'`.
- In the expenses CSV row map (lines 41-49), change to use the new field names:

```typescript
      rows.map((r) => [
        r.date,
        r.vendor_name,
        r.location_name,
        r.details,
        r.category_name ?? '',
        centsToDecimal(r.amount_cents),
        r.paid_by,
      ]),
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/data/report-shared.ts src/lib/data/report-shared.test.ts src/lib/data/report.ts "src/app/(app)/report"
git commit -m "feat(report): group spending by category name; export joined names"
```

---

### Task 7: Budget — drop the category keyword hack

**Files:**
- Modify: `src/lib/data/budget.ts`
- Delete: `src/lib/data/budget.test.ts`

**Interfaces:**
- Produces: `getBudget` computes overall `spentCents` (sum of all expenses in month) but per-category `spentCents = 0`. `expenseKeysForBudget`/`spentForBudgetCategory` removed.

- [ ] **Step 1: Edit `budget.ts`**

- Delete `expenseKeysForBudget` and `spentForBudgetCategory` (lines 10-21).
- In `getBudget`, change the expenses query select from `'category, amount_cents'` to `'amount_cents'`.
- Replace the `byCategoryKey` loop (lines 45-52) with just the total:

```typescript
  const expenses = (expRes.data ?? []) as { amount_cents: number }[]
  const spentTotal = expenses.reduce((a, e) => a + e.amount_cents, 0)
```

- In the `categories` map, set `spentCents: 0` (planned-only; per-category actuals are out of scope):

```typescript
    totalCents: c.total_cents, spentCents: 0,
```

- [ ] **Step 2: Delete the obsolete test**

Run: `git rm src/lib/data/budget.test.ts`

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: `budget.ts` clean (remaining errors only in `categories.ts` hardcoded consumers handled next / UI tasks).

- [ ] **Step 4: Commit**

```bash
git add src/lib/data/budget.ts
git commit -m "refactor(budget): drop hardcoded expense-category keyword mapping"
```

---

### Task 8: Delete hardcoded categories module; green-light backend

**Files:**
- Delete: `src/lib/categories.ts`
- Verify: no remaining imports of `@/lib/categories`.

- [ ] **Step 1: Find remaining references**

Run: `grep -rn "@/lib/categories\|from '\.\./.*categories'" src --include=*.ts --include=*.tsx`
Expected: only UI files handled in later tasks (Add/Edit forms). If any **data-layer** file still imports it, fix per the corresponding task above.

- [ ] **Step 2: Delete the file**

Run: `git rm src/lib/categories.ts`

Note: `AddExpenseForm.tsx` and `EditExpenseForm.tsx` still import it — they are rewritten in Tasks 13-14. Until then the build will fail on those two files only. That is expected; the commit here is the data-layer boundary.

- [ ] **Step 3: Run the full unit-test suite**

Run: `npm test`
Expected: PASS — `catalog-shared`, `triage-shared`, `report-shared`, plus untouched suites (money, summary, etc.). No suite should import `@/lib/categories`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: remove hardcoded categories module (data layer on FK ids)"
```

---

## Phase B — i18n, navigation, Manage

### Task 9: Add all new i18n keys

**Files:**
- Modify: `src/i18n/dictionaries.ts` (add keys to both `en` and `zh`)

- [ ] **Step 1: Add keys to the `en` map**

In `src/i18n/dictionaries.ts`, add these entries inside the `en: { … }` object (anywhere; group near related keys):

```typescript
    'nav.more': 'More',
    'more.title': 'More',
    'more.assets': 'Assets',
    'more.manage': 'Manage lists',
    'manage.title': 'Manage lists',
    'manage.categories': 'Categories',
    'manage.vendors': 'Vendors',
    'manage.locations': 'Locations',
    'manage.addPlaceholder': 'Add new…',
    'manage.add': 'Add',
    'manage.rename': 'Rename',
    'manage.delete': 'Delete',
    'manage.save': 'Save',
    'manage.cancel': 'Cancel',
    'manage.empty': 'Nothing here yet',
    'manage.duplicate': 'Already exists',
    'manage.deleteInUse': 'Used by {n} expenses — delete anyway?',
    'manage.deleteConfirm': 'Delete anyway',
    'expenses.filter': 'Filter',
    'expenses.category': 'Category',
    'filter.title': 'Filter expenses',
    'filter.other': 'Other',
    'filter.apply': 'Apply',
    'filter.clear': 'Clear all',
    'add.selectVendor': 'Select vendor',
    'add.selectLocation': 'Select location',
    'add.noCategories': 'No categories yet — add them in Manage',
    'combobox.search': 'Search…',
    'combobox.create': 'Create “{name}”',
    'combobox.none': 'None',
    'triage.noCategories': 'No categories yet — create them in Manage first',
    'report.uncategorized': 'Uncategorized',
```

- [ ] **Step 2: Add the same keys to the `zh` map**

Add the Chinese equivalents inside `zh: { … }`:

```typescript
    'nav.more': '更多',
    'more.title': '更多',
    'more.assets': '资产',
    'more.manage': '管理列表',
    'manage.title': '管理列表',
    'manage.categories': '类别',
    'manage.vendors': '商家',
    'manage.locations': '地点',
    'manage.addPlaceholder': '新增…',
    'manage.add': '新增',
    'manage.rename': '重命名',
    'manage.delete': '删除',
    'manage.save': '保存',
    'manage.cancel': '取消',
    'manage.empty': '暂无内容',
    'manage.duplicate': '已存在',
    'manage.deleteInUse': '有 {n} 笔支出使用中 — 仍要删除吗？',
    'manage.deleteConfirm': '仍然删除',
    'expenses.filter': '筛选',
    'expenses.category': '类别',
    'filter.title': '筛选支出',
    'filter.other': '其他',
    'filter.apply': '应用',
    'filter.clear': '清除',
    'add.selectVendor': '选择商家',
    'add.selectLocation': '选择地点',
    'add.noCategories': '还没有类别 — 请在“管理”中添加',
    'combobox.search': '搜索…',
    'combobox.create': '创建“{name}”',
    'combobox.none': '无',
    'triage.noCategories': '还没有类别 — 请先在“管理”中创建',
    'report.uncategorized': '未分类',
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors from `dictionaries.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/i18n/dictionaries.ts
git commit -m "i18n: keys for more/manage/filter/combobox"
```

> **Note on `{n}`/`{name}` placeholders:** `t()` returns the raw string; callers do the substitution with `.replace('{n}', String(count))`. Tasks 11-13 do this at each call site.

---

### Task 10: Bottom tab bar → More, and the `/more` menu

**Files:**
- Modify: `src/components/nav/BottomTabBar.tsx`
- Create: `src/app/(app)/more/page.tsx`

- [ ] **Step 1: Swap the Assets tab for More**

In `src/components/nav/BottomTabBar.tsx`:
- Change the icon import line to: `import { Home, Receipt, HandCoins, ChartColumn, LayoutGrid } from 'lucide-react'` (keep `LayoutGrid`).
- Replace the last `TABS` entry with:

```typescript
  { href: '/more', key: 'nav.more', Icon: LayoutGrid },
```

- Update the active-state so `/more` also lights up on its sub-screens. Replace the `active` line (line 21) with:

```typescript
          const active = href === '/'
            ? path === '/' || path.startsWith('/personal')
            : href === '/more'
              ? path.startsWith('/more') || path.startsWith('/assets') || path.startsWith('/manage')
              : path.startsWith(href)
```

- [ ] **Step 2: Create the More menu page**

Create `src/app/(app)/more/page.tsx`:

```tsx
import Link from 'next/link'
import { LayoutGrid, SlidersHorizontal, ChevronRight } from 'lucide-react'
import { getMembership } from '@/lib/data/household'
import { t } from '@/i18n'

export default async function MorePage() {
  const m = await getMembership()
  const locale = m?.language ?? 'en'
  const items = [
    { href: '/assets', label: t(locale, 'more.assets'), Icon: LayoutGrid },
    { href: '/manage', label: t(locale, 'more.manage'), Icon: SlidersHorizontal },
  ]
  return (
    <div className="flex flex-col gap-5 pb-6">
      <h1 className="text-2xl font-extrabold text-[var(--ink-head)]">{t(locale, 'more.title')}</h1>
      <div className="flex flex-col gap-2">
        {items.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className="pressable flex min-h-[56px] items-center gap-3 rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--subtle)]">
              <Icon size={20} className="text-[var(--ink)]" />
            </span>
            <span className="flex-1 text-sm font-bold text-[var(--ink)]">{label}</span>
            <ChevronRight size={18} className="text-[var(--faint)]" />
          </Link>
        ))}
      </div>
    </div>
  )
}
```

Add `SlidersHorizontal` to `IconTile.tsx`'s `ICONS` map only if you plan to reuse it there; here it is imported directly from `lucide-react`, so no change to `IconTile` is needed.

- [ ] **Step 3: Verify in the running app**

Run: `npm run dev`, open `http://localhost:3000/more`.
Expected: the tab bar shows **More** (not Assets); `/more` lists Assets + Manage; tapping Assets reaches the existing assets screen. (Manage 404s until Task 11.)

- [ ] **Step 4: Commit**

```bash
git add src/components/nav/BottomTabBar.tsx "src/app/(app)/more/page.tsx"
git commit -m "feat(nav): replace Assets tab with More menu (Assets + Manage)"
```

---

### Task 11: Manage screen — three list sections with CRUD

**Files:**
- Create: `src/app/(app)/manage/page.tsx`
- Create: `src/app/(app)/manage/actions.ts`
- Create: `src/app/(app)/manage/ManageSection.tsx`

**Interfaces:**
- Consumes: the three data modules (Task 3), `CatalogItem`.
- Produces: server actions `createItemAction/renameItemAction/deleteItemAction/countUsageAction` keyed by `CatalogKind`; a client `ManageSection` reused for all three kinds.

- [ ] **Step 1: Create the server actions**

Create `src/app/(app)/manage/actions.ts`:

```typescript
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
```

- [ ] **Step 2: Create the Manage page (server component)**

Create `src/app/(app)/manage/page.tsx`:

```tsx
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getMembership } from '@/lib/data/household'
import { listCategories } from '@/lib/data/categories'
import { listVendors } from '@/lib/data/vendors'
import { listLocations } from '@/lib/data/locations'
import { t } from '@/i18n'
import { ManageSection } from './ManageSection'

export default async function ManagePage() {
  const m = await getMembership()
  const locale = m?.language ?? 'en'
  const [categories, vendors, locations] = await Promise.all([
    listCategories(), listVendors(), listLocations(),
  ])
  return (
    <div className="flex flex-col gap-6 pb-6">
      <header className="flex items-center gap-1">
        <Link href="/more" aria-label={t(locale, 'common.back')}
          className="pressable-opacity -ml-2 grid h-11 w-11 place-items-center text-[var(--muted)]">
          <ChevronLeft size={24} />
        </Link>
        <h1 className="text-2xl font-extrabold text-[var(--ink-head)]">{t(locale, 'manage.title')}</h1>
      </header>
      <ManageSection kind="category" title={t(locale, 'manage.categories')} items={categories} />
      <ManageSection kind="vendor" title={t(locale, 'manage.vendors')} items={vendors} />
      <ManageSection kind="location" title={t(locale, 'manage.locations')} items={locations} />
    </div>
  )
}
```

- [ ] **Step 3: Create `ManageSection` (client)**

Create `src/app/(app)/manage/ManageSection.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import { useT } from '@/i18n/LocaleProvider'
import { Spinner } from '@/components/ui/Spinner'
import type { CatalogItem } from '@/lib/data/catalog-shared'
import {
  createItemAction, renameItemAction, deleteItemAction, countUsageAction, type CatalogKind,
} from './actions'

export function ManageSection({
  kind, title, items,
}: { kind: CatalogKind; title: string; items: CatalogItem[] }) {
  const t = useT()
  const router = useRouter()
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function add() {
    const name = newName.trim()
    if (!name || adding) return
    setAdding(true); setError(null)
    const res = await createItemAction(kind, name)
    setAdding(false)
    if (!res.ok) { setError(t(`manage.${res.error === 'duplicate' ? 'duplicate' : 'save'}`)); return }
    setNewName(''); router.refresh()
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{title}</h2>
      <div className="flex flex-col gap-2 rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-3">
        {items.length === 0 && (
          <p className="px-1 py-2 text-sm font-semibold text-[var(--faint)]">{t('manage.empty')}</p>
        )}
        {items.map((item) => (
          <ManageRow key={item.id} kind={kind} item={item} onChanged={() => router.refresh()} />
        ))}
        <div className="flex items-center gap-2 pt-1">
          <input
            value={newName}
            onChange={(e) => { setNewName(e.target.value); setError(null) }}
            onKeyDown={(e) => { if (e.key === 'Enter') add() }}
            placeholder={t('manage.addPlaceholder')}
            className="min-h-[44px] flex-1 rounded-xl border border-[var(--hairline)] bg-[var(--paper)] px-3 text-base text-[var(--ink)] outline-none placeholder:text-[var(--faint)]"
          />
          <button
            type="button" onClick={add} disabled={!newName.trim() || adding} aria-busy={adding}
            className="pressable grid h-11 w-11 place-items-center rounded-xl bg-[var(--primary-btn)] text-white disabled:opacity-40"
          >
            {adding ? <Spinner /> : <Plus size={20} />}
          </button>
        </div>
        {error && <p className="px-1 text-xs font-semibold text-[var(--danger)]">{error}</p>}
      </div>
    </section>
  )
}

function ManageRow({
  kind, item, onChanged,
}: { kind: CatalogKind; item: CatalogItem; onChanged: () => void }) {
  const t = useT()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(item.name)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    const clean = name.trim()
    if (!clean || busy) return
    setBusy(true); setError(null)
    const res = await renameItemAction(kind, item.id, clean)
    setBusy(false)
    if (!res.ok) { setError(t(res.error === 'duplicate' ? 'manage.duplicate' : 'error.save_failed')); return }
    setEditing(false); onChanged()
  }

  async function remove() {
    if (busy) return
    const count = await countUsageAction(kind, item.id)
    const msg = count > 0 ? t('manage.deleteInUse').replace('{n}', String(count)) : `${t('manage.delete')}?`
    if (!window.confirm(msg)) return
    setBusy(true)
    const res = await deleteItemAction(kind, item.id)
    setBusy(false)
    if (res.ok) onChanged()
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          value={name} autoFocus
          onChange={(e) => { setName(e.target.value); setError(null) }}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
          className="min-h-[44px] flex-1 rounded-xl border border-[var(--primary)] bg-[var(--paper)] px-3 text-base text-[var(--ink)] outline-none"
        />
        <button type="button" onClick={save} disabled={busy} className="pressable grid h-11 w-11 place-items-center rounded-xl bg-[var(--primary-btn)] text-white disabled:opacity-40">
          {busy ? <Spinner /> : <Check size={18} />}
        </button>
        <button type="button" onClick={() => { setEditing(false); setName(item.name) }} className="pressable grid h-11 w-11 place-items-center rounded-xl border border-[var(--hairline)] text-[var(--muted)]">
          <X size={18} />
        </button>
        {error && <span className="text-xs font-semibold text-[var(--danger)]">{error}</span>}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="flex-1 truncate px-1 text-sm font-bold text-[var(--ink)]">{item.name}</span>
      <button type="button" aria-label={t('manage.rename')} onClick={() => setEditing(true)} className="pressable-opacity grid h-11 w-11 place-items-center text-[var(--muted)]">
        <Pencil size={16} />
      </button>
      <button type="button" aria-label={t('manage.delete')} onClick={remove} disabled={busy} className="pressable-opacity grid h-11 w-11 place-items-center text-[var(--danger)] disabled:opacity-40">
        {busy ? <Spinner /> : <Trash2 size={16} />}
      </button>
    </div>
  )
}
```

> **Reorder is out of scope this round** (deferred per pre-flight decision). Items display in creation order via `sort_order`. Do not add reorder data functions, actions, or UI here — a later self-contained task adds drag-reorder end-to-end.

- [ ] **Step 4: Verify in the app**

Run: `npm run dev`, open `/manage`. Add a category ("Groceries"), rename it, add a duplicate ("groceries" → shows "Already exists"), delete one (confirm dialog). Vendors/Locations show the seeded values.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/manage"
git commit -m "feat(manage): CRUD screen for categories, vendors, locations"
```

---

## Phase C — Forms

### Task 12: Reusable `Combobox` (search + create)

**Files:**
- Create: `src/components/ui/Combobox.tsx`

**Interfaces:**
- Produces: `Combobox` component:

```typescript
type ComboboxProps = {
  label: string
  placeholder: string             // e.g. "Select vendor"
  items: CatalogItem[]
  valueId: string | null
  onChange: (id: string | null) => void
  onCreate: (name: string) => Promise<{ ok: true; id: string } | { ok: false; error: string }>
}
```

- [ ] **Step 1: Write the component**

Create `src/components/ui/Combobox.tsx`:

```tsx
'use client'
import { useMemo, useState } from 'react'
import { ChevronDown, Plus, Check } from 'lucide-react'
import { useT } from '@/i18n/LocaleProvider'
import { Spinner } from '@/components/ui/Spinner'
import { normalizeName, findCaseInsensitiveDuplicate, type CatalogItem } from '@/lib/data/catalog-shared'

type Props = {
  label: string
  placeholder: string
  items: CatalogItem[]
  valueId: string | null
  onChange: (id: string | null) => void
  onCreate: (name: string) => Promise<{ ok: true; id: string } | { ok: false; error: string }>
}

export function Combobox({ label, placeholder, items, valueId, onChange, onCreate }: Props) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [localItems, setLocalItems] = useState<CatalogItem[]>(items)

  const selected = localItems.find((i) => i.id === valueId) ?? null
  const clean = normalizeName(query)
  const filtered = useMemo(() => {
    const q = clean.toLowerCase()
    return q ? localItems.filter((i) => i.name.toLowerCase().includes(q)) : localItems
  }, [localItems, clean])
  const exactExists = clean !== '' && findCaseInsensitiveDuplicate(clean, localItems) !== null
  const canCreate = clean !== '' && !exactExists

  async function create() {
    if (!canCreate || creating) return
    setCreating(true)
    const res = await onCreate(clean)
    setCreating(false)
    if (res.ok) {
      const item = { id: res.id, name: clean, sort_order: localItems.length }
      setLocalItems((prev) => [...prev, item])
      onChange(res.id)
      setQuery(''); setOpen(false)
    }
    // duplicate race: item already exists — leave panel open, user can pick it
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-[var(--muted)]">{label}</span>
      <button
        type="button" onClick={() => setOpen((v) => !v)}
        className="flex min-h-[44px] items-center justify-between gap-2 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-left"
      >
        <span className={selected ? 'text-base text-[var(--ink)]' : 'text-base text-[var(--faint)]'}>
          {selected ? selected.name : placeholder}
        </span>
        <ChevronDown size={18} className="shrink-0 text-[var(--muted)]" />
      </button>

      {open && (
        <div className="mt-1 flex flex-col gap-1 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-2 shadow-[0_6px_20px_oklch(0.5_0.05_45/.12)]">
          <input
            value={query} autoFocus
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && canCreate) create() }}
            placeholder={t('combobox.search')}
            className="min-h-[40px] rounded-lg border border-[var(--hairline)] bg-[var(--paper)] px-3 text-base text-[var(--ink)] outline-none placeholder:text-[var(--faint)]"
          />
          <div className="flex max-h-48 flex-col overflow-y-auto">
            {selected && (
              <button type="button" onClick={() => { onChange(null); setOpen(false) }}
                className="pressable-opacity flex min-h-[40px] items-center px-3 text-sm font-semibold text-[var(--muted)]">
                {t('combobox.none')}
              </button>
            )}
            {filtered.map((i) => (
              <button key={i.id} type="button" onClick={() => { onChange(i.id); setQuery(''); setOpen(false) }}
                className="pressable-opacity flex min-h-[40px] items-center justify-between gap-2 px-3 text-sm font-semibold text-[var(--ink)]">
                <span className="truncate">{i.name}</span>
                {i.id === valueId && <Check size={16} className="text-[var(--primary)]" />}
              </button>
            ))}
            {canCreate && (
              <button type="button" onClick={create} disabled={creating}
                className="pressable-opacity flex min-h-[40px] items-center gap-2 px-3 text-sm font-bold text-[var(--primary)] disabled:opacity-50">
                {creating ? <Spinner /> : <Plus size={16} />}
                {t('combobox.create').replace('{name}', clean)}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: `Combobox.tsx` clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/Combobox.tsx
git commit -m "feat(ui): Combobox with search + create-if-absent"
```

---

### Task 13: Add form rework — chips, comboboxes, amount below numpad

**Files:**
- Create: `src/app/(app)/expenses/add/catalog-actions.ts` (inline-create actions for the comboboxes)
- Modify: `src/app/(app)/expenses/add/page.tsx` (load lists, pass as props)
- Modify: `src/app/(app)/expenses/add/AddExpenseForm.tsx` (full rewrite)

**Interfaces:**
- Consumes: `listCategories/Vendors/Locations`, `Combobox`, keypad helpers, `createVendorAction`/`createLocationAction`.

- [ ] **Step 1: Create inline-create actions**

Create `src/app/(app)/expenses/add/catalog-actions.ts`:

```typescript
'use server'
import { revalidatePath } from 'next/cache'
import { createVendor } from '@/lib/data/vendors'
import { createLocation } from '@/lib/data/locations'

export async function createVendorAction(
  name: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const res = await createVendor(name)
  if (res.ok) { revalidatePath('/expenses/add'); return { ok: true, id: res.id } }
  return { ok: false, error: res.error }
}

export async function createLocationAction(
  name: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const res = await createLocation(name)
  if (res.ok) { revalidatePath('/expenses/add'); return { ok: true, id: res.id } }
  return { ok: false, error: res.error }
}
```

- [ ] **Step 2: Load the lists in the Add page**

Replace `src/app/(app)/expenses/add/page.tsx`:

```tsx
import { listCategories } from '@/lib/data/categories'
import { listVendors } from '@/lib/data/vendors'
import { listLocations } from '@/lib/data/locations'
import { AddExpenseForm } from './AddExpenseForm'

export default async function AddExpensePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const [categories, vendors, locations] = await Promise.all([
    listCategories(), listVendors(), listLocations(),
  ])
  return <AddExpenseForm error={error} categories={categories} vendors={vendors} locations={locations} />
}
```

- [ ] **Step 3: Rewrite `AddExpenseForm.tsx`**

Full new content:

```tsx
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useT } from '@/i18n/LocaleProvider'
import { formatRM, pushDigit, pushDoubleZero, backspace } from '@/lib/money'
import type { CatalogItem } from '@/lib/data/catalog-shared'
import { MemberAvatar } from '@/components/ui/MemberAvatar'
import { SubmitButton } from '@/components/ui/SubmitButton'
import { Combobox } from '@/components/ui/Combobox'
import { addExpenseAction } from './actions'
import { createVendorAction, createLocationAction } from './catalog-actions'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', '⌫'] as const
const MEMBERS = ['CH', 'JC'] as const

export function AddExpenseForm({
  error, categories, vendors, locations,
}: {
  error?: string
  categories: CatalogItem[]
  vendors: CatalogItem[]
  locations: CatalogItem[]
}) {
  const t = useT()
  const [cents, setCents] = useState(0)
  const [payer, setPayer] = useState<'CH' | 'JC' | null>(null)
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [vendorId, setVendorId] = useState<string | null>(null)
  const [locationId, setLocationId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))

  function pressKey(key: (typeof KEYS)[number]) {
    if (key === '⌫') return setCents((c) => backspace(c))
    if (key === '00') return setCents((c) => pushDoubleZero(c))
    setCents((c) => pushDigit(c, Number(key)))
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--paper)]">
      <div className="mx-auto flex min-h-0 w-full max-w-[430px] flex-1 flex-col px-[18px] pb-6 pt-4">
        {/* header */}
        <div className="flex items-center justify-between py-2">
          <Link href="/expenses" aria-label={t('common.back')}
            className="pressable-opacity grid h-11 w-11 place-items-center text-2xl text-[var(--muted)]">‹</Link>
          <h1 className="text-base font-bold text-[var(--ink-head)]">{t('add.title')}</h1>
          <Link href="/expenses" aria-label={t('common.close')}
            className="pressable-opacity grid h-11 w-11 place-items-center text-2xl text-[var(--muted)]">×</Link>
        </div>

        <form action={addExpenseAction} className="flex min-h-0 flex-1 flex-col">
          <input type="hidden" name="amountCents" value={cents} />
          <input type="hidden" name="categoryId" value={categoryId ?? ''} />
          <input type="hidden" name="vendorId" value={vendorId ?? ''} />
          <input type="hidden" name="locationId" value={locationId ?? ''} />
          <input type="hidden" name="paidBy" value={payer ?? ''} />
          <input type="hidden" name="note" value={note} />
          <input type="hidden" name="dateISO" value={date} />

          {/* scrollable middle */}
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-4">
            {/* category chips: 2 rows tall, scroll horizontally when overflowing */}
            <div>
              <p className="mb-2 text-sm font-semibold text-[var(--muted)]">{t('expenses.category')}</p>
              {categories.length === 0 ? (
                <Link href="/manage" className="text-sm font-semibold text-[var(--primary)]">
                  {t('add.noCategories')}
                </Link>
              ) : (
                <div className="grid grid-flow-col grid-rows-2 gap-2 overflow-x-auto pb-1"
                  style={{ gridAutoColumns: 'max-content' }}>
                  {categories.map((c) => {
                    const selected = categoryId === c.id
                    return (
                      <button type="button" key={c.id}
                        onClick={() => setCategoryId((cur) => (cur === c.id ? null : c.id))}
                        className="pressable flex min-h-[44px] items-center rounded-full border px-4 py-2.5 text-sm font-semibold whitespace-nowrap"
                        style={{
                          borderColor: selected ? 'var(--primary)' : 'var(--hairline)',
                          background: selected ? 'var(--primary)' : 'var(--surface)',
                          color: selected ? 'white' : 'var(--ink)',
                        }}>
                        {c.name}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('add.note')}
              className="min-h-[44px] rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 text-base text-[var(--ink)] outline-none placeholder:text-[var(--faint)]" />

            <Combobox label={t('add.vendor')} placeholder={t('add.selectVendor')} items={vendors}
              valueId={vendorId} onChange={setVendorId} onCreate={createVendorAction} />
            <Combobox label={t('add.location')} placeholder={t('add.selectLocation')} items={locations}
              valueId={locationId} onChange={setLocationId} onCreate={createLocationAction} />

            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-[var(--muted)]">{t('add.date')}</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--ink)] outline-none" />
            </label>

            {error && <p className="text-sm font-semibold text-[var(--danger)]">{t(`error.${error}`)}</p>}
          </div>

          {/* bottom cluster: numpad -> amount -> who-paid -> save */}
          <div className="flex shrink-0 flex-col gap-3 pt-2">
            <div className="grid grid-cols-3 gap-2">
              {KEYS.map((k) => (
                <button key={k} type="button" onClick={() => pressKey(k)}
                  className="pressable rounded-xl bg-[var(--surface)] text-lg font-semibold text-[var(--ink)]"
                  style={{ height: 52 }}>{k}</button>
              ))}
            </div>

            <div className="flex items-center justify-center gap-1 text-[32px] leading-none font-extrabold text-[var(--ink-head)]">
              {formatRM(cents)}
              <span className="ml-1 inline-block h-7 w-[3px] animate-pulse bg-[var(--primary)]" />
            </div>

            <div className="flex gap-2">
              {MEMBERS.map((mem) => {
                const selected = payer === mem
                const memberColor = mem === 'CH' ? 'var(--member-ch)' : 'var(--member-jc)'
                return (
                  <button type="button" key={mem} onClick={() => setPayer((p) => (p === mem ? null : mem))}
                    className="pressable flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 font-semibold"
                    style={{
                      borderColor: selected ? memberColor : 'var(--hairline)',
                      background: selected ? memberColor : 'var(--surface)',
                      color: selected ? 'white' : 'var(--ink)',
                    }}>
                    <MemberAvatar member={mem} size={24} />{mem}
                  </button>
                )
              })}
            </div>

            <SubmitButton disabled={cents <= 0}
              className="w-full rounded-xl bg-[var(--primary-btn)] py-3.5 font-bold text-white disabled:opacity-40">
              {t('add.save')}
            </SubmitButton>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify the flow**

Run: `npm run dev`, open `/expenses/add`. Confirm: category chips never exceed 2 rows and scroll sideways; the amount stays visible above the keypad as you type; vendor/location dropdowns filter as you type and offer "Create …" for a new name; saving creates the expense (check `/expenses`).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/expenses/add"
git commit -m "feat(add): managed category chips + vendor/location comboboxes + amount by numpad"
```

---

### Task 14: Edit form rework — keypad + comboboxes

**Files:**
- Modify: `src/app/(app)/expenses/edit/[id]/page.tsx` (load lists)
- Modify: `src/app/(app)/expenses/edit/[id]/EditExpenseForm.tsx` (full rewrite)
- Create: `src/app/(app)/expenses/edit/[id]/catalog-actions.ts` (revalidate the edit path)

- [ ] **Step 1: Create edit-scoped inline-create actions**

Create `src/app/(app)/expenses/edit/[id]/catalog-actions.ts`:

```typescript
'use server'
import { revalidatePath } from 'next/cache'
import { createVendor } from '@/lib/data/vendors'
import { createLocation } from '@/lib/data/locations'

export async function createVendorAction(name: string) {
  const res = await createVendor(name)
  if (res.ok) revalidatePath('/expenses')
  return res.ok ? { ok: true as const, id: res.id } : { ok: false as const, error: res.error }
}
export async function createLocationAction(name: string) {
  const res = await createLocation(name)
  if (res.ok) revalidatePath('/expenses')
  return res.ok ? { ok: true as const, id: res.id } : { ok: false as const, error: res.error }
}
```

- [ ] **Step 2: Load lists in the Edit page**

Replace `src/app/(app)/expenses/edit/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { getExpense } from '@/lib/data/expenses'
import { listCategories } from '@/lib/data/categories'
import { listVendors } from '@/lib/data/vendors'
import { listLocations } from '@/lib/data/locations'
import { EditExpenseForm } from './EditExpenseForm'

export default async function EditExpensePage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams
  const [row, categories, vendors, locations] = await Promise.all([
    getExpense(id), listCategories(), listVendors(), listLocations(),
  ])
  if (!row) notFound()
  return <EditExpenseForm row={row} error={error} categories={categories} vendors={vendors} locations={locations} />
}
```

- [ ] **Step 3: Rewrite `EditExpenseForm.tsx`**

Full new content — mirrors the Add form (keypad + bottom cluster + comboboxes), seeded from `row`:

```tsx
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useT } from '@/i18n/LocaleProvider'
import { formatRM, pushDigit, pushDoubleZero, backspace } from '@/lib/money'
import type { CatalogItem } from '@/lib/data/catalog-shared'
import type { ExpenseRow } from '@/lib/data/types'
import { MemberAvatar } from '@/components/ui/MemberAvatar'
import { SubmitButton } from '@/components/ui/SubmitButton'
import { Combobox } from '@/components/ui/Combobox'
import { updateExpenseAction } from '../../actions'
import { createVendorAction, createLocationAction } from './catalog-actions'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', '⌫'] as const
const MEMBERS = ['CH', 'JC'] as const

export function EditExpenseForm({
  row, error, categories, vendors, locations,
}: {
  row: ExpenseRow
  error?: string
  categories: CatalogItem[]
  vendors: CatalogItem[]
  locations: CatalogItem[]
}) {
  const t = useT()
  const [cents, setCents] = useState(row.amount_cents)
  const [payer, setPayer] = useState<'CH' | 'JC' | null>(row.paid_by)
  const [categoryId, setCategoryId] = useState<string | null>(row.category_id)
  const [vendorId, setVendorId] = useState<string | null>(row.vendor_id)
  const [locationId, setLocationId] = useState<string | null>(row.location_id)
  const [note, setNote] = useState(row.details ?? '')
  const [date, setDate] = useState(row.date)

  function pressKey(key: (typeof KEYS)[number]) {
    if (key === '⌫') return setCents((c) => backspace(c))
    if (key === '00') return setCents((c) => pushDoubleZero(c))
    setCents((c) => pushDigit(c, Number(key)))
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--paper)]">
      <div className="mx-auto flex min-h-0 w-full max-w-[430px] flex-1 flex-col px-[18px] pb-6 pt-4">
        <div className="flex items-center justify-between py-2">
          <Link href="/expenses" aria-label={t('common.back')}
            className="pressable-opacity grid h-11 w-11 place-items-center text-2xl text-[var(--muted)]">‹</Link>
          <h1 className="text-base font-bold text-[var(--ink-head)]">{t('edit.title')}</h1>
          <Link href="/expenses" aria-label={t('common.close')}
            className="pressable-opacity grid h-11 w-11 place-items-center text-2xl text-[var(--muted)]">×</Link>
        </div>

        <form action={updateExpenseAction} className="flex min-h-0 flex-1 flex-col">
          <input type="hidden" name="id" value={row.id} />
          <input type="hidden" name="amountCents" value={cents} />
          <input type="hidden" name="categoryId" value={categoryId ?? ''} />
          <input type="hidden" name="vendorId" value={vendorId ?? ''} />
          <input type="hidden" name="locationId" value={locationId ?? ''} />
          <input type="hidden" name="paidBy" value={payer ?? ''} />
          <input type="hidden" name="note" value={note} />
          <input type="hidden" name="dateISO" value={date} />

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-4">
            <div>
              <p className="mb-2 text-sm font-semibold text-[var(--muted)]">{t('expenses.category')}</p>
              {categories.length === 0 ? (
                <Link href="/manage" className="text-sm font-semibold text-[var(--primary)]">{t('add.noCategories')}</Link>
              ) : (
                <div className="grid grid-flow-col grid-rows-2 gap-2 overflow-x-auto pb-1" style={{ gridAutoColumns: 'max-content' }}>
                  {categories.map((c) => {
                    const selected = categoryId === c.id
                    return (
                      <button type="button" key={c.id}
                        onClick={() => setCategoryId((cur) => (cur === c.id ? null : c.id))}
                        className="pressable flex min-h-[44px] items-center rounded-full border px-4 py-2.5 text-sm font-semibold whitespace-nowrap"
                        style={{
                          borderColor: selected ? 'var(--primary)' : 'var(--hairline)',
                          background: selected ? 'var(--primary)' : 'var(--surface)',
                          color: selected ? 'white' : 'var(--ink)',
                        }}>{c.name}</button>
                    )
                  })}
                </div>
              )}
            </div>

            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('add.note')}
              className="min-h-[44px] rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 text-base text-[var(--ink)] outline-none placeholder:text-[var(--faint)]" />

            <Combobox label={t('add.vendor')} placeholder={t('add.selectVendor')} items={vendors}
              valueId={vendorId} onChange={setVendorId} onCreate={createVendorAction} />
            <Combobox label={t('add.location')} placeholder={t('add.selectLocation')} items={locations}
              valueId={locationId} onChange={setLocationId} onCreate={createLocationAction} />

            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-[var(--muted)]">{t('add.date')}</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--ink)] outline-none" />
            </label>

            {error && <p className="text-sm font-semibold text-[var(--danger)]">{t(`error.${error}`)}</p>}
          </div>

          <div className="flex shrink-0 flex-col gap-3 pt-2">
            <div className="grid grid-cols-3 gap-2">
              {KEYS.map((k) => (
                <button key={k} type="button" onClick={() => pressKey(k)}
                  className="pressable rounded-xl bg-[var(--surface)] text-lg font-semibold text-[var(--ink)]"
                  style={{ height: 52 }}>{k}</button>
              ))}
            </div>
            <div className="flex items-center justify-center gap-1 text-[32px] leading-none font-extrabold text-[var(--ink-head)]">
              {formatRM(cents)}
              <span className="ml-1 inline-block h-7 w-[3px] animate-pulse bg-[var(--primary)]" />
            </div>
            <div className="flex gap-2">
              {MEMBERS.map((mem) => {
                const selected = payer === mem
                const memberColor = mem === 'CH' ? 'var(--member-ch)' : 'var(--member-jc)'
                return (
                  <button type="button" key={mem} onClick={() => setPayer((p) => (p === mem ? null : mem))}
                    className="pressable flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 font-semibold"
                    style={{
                      borderColor: selected ? memberColor : 'var(--hairline)',
                      background: selected ? memberColor : 'var(--surface)',
                      color: selected ? 'white' : 'var(--ink)',
                    }}>
                    <MemberAvatar member={mem} size={24} />{mem}
                  </button>
                )
              })}
            </div>
            <SubmitButton disabled={cents <= 0}
              className="w-full rounded-xl bg-[var(--primary-btn)] py-3.5 font-bold text-white disabled:opacity-40">
              {t('edit.saveChanges')}
            </SubmitButton>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify**

Run: `npm run dev`. From `/expenses`, swipe a row → Edit. Confirm amount seeds from the row, keypad edits it, category/vendor/location pre-select, Save persists.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/expenses/edit"
git commit -m "feat(edit): keypad entry + comboboxes matching add form"
```

---

## Phase D — Filter & list

### Task 15: Filter sheet on the expenses list

**Files:**
- Modify: `src/app/(app)/expenses/page.tsx` (load the three lists, pass to view)
- Create: `src/app/(app)/expenses/FilterSheet.tsx`
- Modify: `src/app/(app)/expenses/ExpensesView.tsx` (remove chip row; add Filter button + sheet; display joined names; neutral tile)

**Interfaces:**
- Produces: `FilterSheet` with `selected: { categoryId, vendorId, locationId }` where each is `string | 'other' | null`; AND-combined filtering.

- [ ] **Step 1: Load catalog lists in the expenses page**

In `src/app/(app)/expenses/page.tsx`, add the three list fetches and pass them:

```tsx
import { listExpenses, getMonthTotalCents, countExpensesNeedingTriage } from '@/lib/data/expenses'
import { listCategories } from '@/lib/data/categories'
import { listVendors } from '@/lib/data/vendors'
import { listLocations } from '@/lib/data/locations'
import { ExpensesView } from './ExpensesView'
```

Change the `Promise.all` to also fetch the lists and pass `categories`, `vendors`, `locations` props to `<ExpensesView … />`:

```tsx
  const [rows, totalCents, triageCount, categories, vendors, locations] = await Promise.all([
    listExpenses({ year, month }),
    getMonthTotalCents(year, month),
    countExpensesNeedingTriage(),
    listCategories(), listVendors(), listLocations(),
  ])
  // …
  return (
    <ExpensesView rows={rows} totalCents={totalCents} year={year} month={month}
      todayISO={todayISO} triageCount={triageCount}
      categories={categories} vendors={vendors} locations={locations} />
  )
```

- [ ] **Step 2: Create `FilterSheet.tsx`**

Create `src/app/(app)/expenses/FilterSheet.tsx`:

```tsx
'use client'
import { useT } from '@/i18n/LocaleProvider'
import type { CatalogItem } from '@/lib/data/catalog-shared'

export type FilterValue = string | 'other' | null
export type Filters = { categoryId: FilterValue; vendorId: FilterValue; locationId: FilterValue }

function Group({
  title, items, value, onPick,
}: { title: string; items: CatalogItem[]; value: FilterValue; onPick: (v: FilterValue) => void }) {
  const t = useT()
  const chip = (active: boolean) => ({
    borderColor: active ? 'var(--primary)' : 'var(--hairline)',
    background: active ? 'var(--primary)' : 'var(--surface)',
    color: active ? 'white' : 'var(--ink)',
  })
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{title}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((i) => {
          const active = value === i.id
          return (
            <button key={i.id} type="button" onClick={() => onPick(active ? null : i.id)}
              className="pressable flex min-h-[40px] items-center rounded-full border px-3 py-2 text-sm font-semibold whitespace-nowrap"
              style={chip(active)}>{i.name}</button>
          )
        })}
        <button type="button" onClick={() => onPick(value === 'other' ? null : 'other')}
          className="pressable flex min-h-[40px] items-center rounded-full border px-3 py-2 text-sm font-semibold whitespace-nowrap"
          style={chip(value === 'other')}>{t('filter.other')}</button>
      </div>
    </div>
  )
}

export function FilterSheet({
  categories, vendors, locations, filters, onChange, onClose,
}: {
  categories: CatalogItem[]; vendors: CatalogItem[]; locations: CatalogItem[]
  filters: Filters; onChange: (f: Filters) => void; onClose: () => void
}) {
  const t = useT()
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/30" onClick={onClose}>
      <div className="mx-auto w-full max-w-[430px] rounded-t-2xl bg-[var(--paper)] p-5 pb-8"
        onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-[var(--ink-head)]">{t('filter.title')}</h2>
          <button type="button" onClick={() => onChange({ categoryId: null, vendorId: null, locationId: null })}
            className="pressable-opacity text-sm font-bold text-[var(--primary)]">{t('filter.clear')}</button>
        </div>
        <div className="flex max-h-[60vh] flex-col gap-5 overflow-y-auto">
          <Group title={t('expenses.category')} items={categories} value={filters.categoryId}
            onPick={(v) => onChange({ ...filters, categoryId: v })} />
          <Group title={t('add.vendor')} items={vendors} value={filters.vendorId}
            onPick={(v) => onChange({ ...filters, vendorId: v })} />
          <Group title={t('add.location')} items={locations} value={filters.locationId}
            onPick={(v) => onChange({ ...filters, locationId: v })} />
        </div>
        <button type="button" onClick={onClose}
          className="pressable mt-5 w-full rounded-xl bg-[var(--primary-btn)] py-3.5 font-bold text-white">
          {t('filter.apply')}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Update `ExpensesView.tsx`**

- Imports: remove `CATEGORIES, categoryLabel`; add `import type { CatalogItem } from '@/lib/data/catalog-shared'` and `import { FilterSheet, type Filters, type FilterValue } from './FilterSheet'`; add `SlidersHorizontal` from `lucide-react`.
- Props type gains `categories: CatalogItem[]; vendors: CatalogItem[]; locations: CatalogItem[]`.
- Delete `presentCategoryKeys` (lines 35-40) and the entire "filter chips" block (lines 110-142).
- Replace the single `selected` state with:

```tsx
  const [filters, setFilters] = useState<Filters>({ categoryId: null, vendorId: null, locationId: null })
  const [sheetOpen, setSheetOpen] = useState(false)
  const activeCount = [filters.categoryId, filters.vendorId, filters.locationId].filter((v) => v !== null).length

  const matchField = (rowId: string | null, f: FilterValue) =>
    f === null ? true : f === 'other' ? rowId === null : rowId === f
  const filteredRows = rows.filter((r) =>
    matchField(r.category_id, filters.categoryId) &&
    matchField(r.vendor_id, filters.vendorId) &&
    matchField(r.location_id, filters.locationId))
  const groups = groupByDay(filteredRows, todayISO)
```

- Add a **Filter** button in the header row (near the title). Example, placed right after the `<h1>`:

```tsx
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-[var(--ink-head)]">{t('expenses.title')}</h1>
        <button type="button" onClick={() => setSheetOpen(true)}
          className="pressable-opacity flex min-h-[40px] items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-3 text-sm font-bold text-[var(--ink)]">
          <SlidersHorizontal size={16} />
          {t('expenses.filter')}{activeCount > 0 ? ` · ${activeCount}` : ''}
        </button>
      </div>
```

(Remove the standalone `<h1>` that previously existed.)

- At the end of the component (before the closing `</div>` that wraps everything, after the `<Fab … />`), render the sheet:

```tsx
      {sheetOpen && (
        <FilterSheet categories={categories} vendors={vendors} locations={locations}
          filters={filters} onChange={setFilters} onClose={() => setSheetOpen(false)} />
      )}
```

- In `ExpenseRowCard`, replace the category lookup: delete `const cat = CATEGORIES.find(...)`, `iconName`, `tint`; use a neutral tile — `<IconTile name="Tag" tint="var(--subtle)" />`. Change `title` to `row.vendor_name || row.details || row.category_name || t('expenses.title')` and `subParts` to `[row.category_name, row.paid_by].filter(...)`.

- [ ] **Step 4: Verify**

Run: `npm run dev`, open `/expenses`. Confirm the always-on chip row is gone; the Filter button opens the sheet; picking Category + Vendor narrows the list (AND); "Other" shows rows with no link; the badge shows the active count.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/expenses/page.tsx" "src/app/(app)/expenses/FilterSheet.tsx" "src/app/(app)/expenses/ExpensesView.tsx"
git commit -m "feat(expenses): unified filter sheet (category/vendor/location + Other)"
```

---

## Phase E — Seed & finalize

### Task 16: Regenerate local seed for the new tables

**Files:**
- Modify: `supabase/seed/generate_seed.py`
- Regenerate: `supabase/seed/seed.sql`

- [ ] **Step 1: Update the generator**

In `supabase/seed/generate_seed.py`, update the expenses section so it: (1) collects distinct non-`-` vendor and location strings, (2) emits `insert into vendors (household_id, name) values (…)` and `insert into locations (…)` with stable UUIDs, and (3) emits each expense insert using `vendor_id`/`location_id` (looked up from the emitted maps) and **omits** the dropped `vendor`/`location`/`category` text columns. Categories: emit none. Read the file first to match its existing household id + formatting conventions.

- [ ] **Step 2: Regenerate `seed.sql`**

Run: `python supabase/seed/generate_seed.py > supabase/seed/seed.sql` (or the file's documented invocation — check its `__main__`/argparse; adjust if it writes the file directly).

- [ ] **Step 3: Sanity-check the output**

Run: `grep -c "insert into vendors" supabase/seed/seed.sql; grep -c "insert into locations" supabase/seed/seed.sql; grep -c "vendor_id" supabase/seed/seed.sql`
Expected: vendors ≈ 8, locations ≈ 8, and expense inserts reference `vendor_id`. No `insert into expenses(...vendor,location,category...)` remaining.

- [ ] **Step 4: Commit**

```bash
git add supabase/seed/generate_seed.py supabase/seed/seed.sql
git commit -m "chore(seed): seed vendors/locations and link expenses by id"
```

---

### Task 17: Full verification pass

**Files:** none (verification only).

- [ ] **Step 1: Lint**

Run: `npm run lint`
Expected: no errors. Fix any (commonly: unused imports left from the rewrites — `categoryLabel`, `CATEGORIES`, `selected` state).

- [ ] **Step 2: Unit tests**

Run: `npm test`
Expected: all suites pass; no suite imports `@/lib/categories`.

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: clean build. Investigate any `category`/`vendor`/`location` text-field reference the build flags (a missed consumer).

- [ ] **Step 4: Manual end-to-end (dev server)**

Run: `npm run dev`, then walk the flow:
1. `/manage` — add a category "Groceries"; rename; add duplicate (blocked); vendors/locations show seeded values.
2. `/expenses/add` — 2-row scrolling category chips; amount visible above keypad; create a new vendor inline; save.
3. `/expenses` — Filter sheet: filter by the category, then "Other" vendor.
4. `/expenses` swipe → Edit — fields pre-fill; keypad edits amount; save.
5. `/expenses/triage` — assign category (from the list) + payer.
6. `/report` — spending grouped by category name; "Uncategorized" bucket present.
7. Tab bar shows **More** → Assets + Manage.

- [ ] **Step 5: Final commit (if any lint/type fixes were made)**

```bash
git add -A
git commit -m "chore: lint/type fixes for expense catalog feature"
```

---

## Deferred (out of scope — recorded in the spec §12)

- Move Budget's manage (categories & commitments) into `/manage`.
- Drag-reorder in `ManageSection` end-to-end (pure `reorderIds` helper + `reorder<Kind>` data fns + `reorderAction` + drag UI) — none of it built yet.
- Optional `color` column on categories (seam preserved in `categories.ts`).
- Actual-vs-budget spend link (budget currently planned-only).
