# Joint Fund Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Fund screen's paid/pending 12-month grid with a filterable contributions ledger, and add a recurring-funds feature that suggests contribution amounts.

**Architecture:** A new `recurring_funds` table holds per-member contribution templates (CRUD on its own screen). The existing `joint_fund_contributions` table is reused as the records ledger with full add/edit/delete. Pure calculation/filter helpers live in `-shared.ts` files (unit-tested with vitest); server reads/writes live in data-layer modules; mutations are `'use server'` actions colocated with screens. The whole feature runs client-side over all loaded records (2-person household, tiny data volume), using pure helpers for filtering and totals.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind 4, Supabase (Postgres + RLS), vitest + jsdom.

## Global Constraints

- **Money is integer cents** (`bigint` in Postgres, `number` in TS). Never floats. Format only at the edge with `formatRM` from `@/lib/money`.
- **Members are hardcoded** `'CH'` and `'JC'`.
- **Every query is household-scoped** via `getMembership()` (`@/lib/data/household`) filtering by `householdId`, through the anon client so RLS applies. Never the admin client here.
- **Data-layer split:** pure framework-free logic in `<domain>-shared.ts` (client-importable, tested); Supabase reads/writes in `<domain>.ts` (server-only).
- **Server Actions** in `'use server'` files: parse `FormData` → call data-layer fn → `revalidatePath(...)` → `redirect(...)`; surface errors via `?error=` redirect.
- **i18n:** every user-facing string uses `t(key)` with a key added to BOTH the `en` and `zh` maps in `src/i18n/dictionaries.ts`.
- **DB changes are applied manually** in the Supabase SQL editor (no local Postgres). A migration file is the source of truth.
- **Out of scope (do not touch):** `joint_fund_config`, `budget_categories`, `monthly_commitments`, the Budget screen, and the existing fund config icon/editor on the Fund screen (it stays and coexists).

---

### Task 1: Database — `recurring_funds` table + RLS

**Files:**
- Create: `supabase/migrations/0006_recurring_funds.sql`

**Interfaces:**
- Produces: table `recurring_funds(id, household_id, member_code, name, amount_cents, remark, sort_order)` with household-scoped RLS. Later tasks read/write it through the anon client.

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/0006_recurring_funds.sql`:

```sql
-- Recurring funds: per-member contribution templates that suggest the amount
-- when adding a joint-fund contribution record. One row per member.
create table recurring_funds (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  member_code text not null check (member_code in ('CH','JC')),
  name text not null,
  amount_cents bigint not null default 0,
  remark text,
  sort_order int not null default 0
);

alter table recurring_funds enable row level security;

create policy rf_all on recurring_funds
  for all using (is_member(household_id)) with check (is_member(household_id));
```

- [ ] **Step 2: Apply it in Supabase**

Paste the file's contents into the Supabase SQL editor and run it (per `SETUP.md` — there is no local migration tooling).

- [ ] **Step 3: Verify the table exists and is RLS-protected**

Run in the SQL editor:

```sql
select tablename, rowsecurity from pg_tables where tablename = 'recurring_funds';
```

Expected: one row, `rowsecurity = true`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0006_recurring_funds.sql
git commit -m "feat(fund): add recurring_funds table + RLS"
```

---

### Task 2: Pure helpers + types (recurring funds)

**Files:**
- Create: `src/lib/data/recurring-funds-shared.ts`
- Test: `src/lib/data/recurring-funds-shared.test.ts`

**Interfaces:**
- Produces:
  - `type Member = 'CH' | 'JC'` (re-imported from `./types`)
  - `type RecurringFund = { id: string; memberCode: Member; name: string; amountCents: number; remark: string | null; sortOrder: number }`
  - `type RecurringFundInput = { name: string; amountCents: number; remark: string | null; members: Member[] }`
  - `type RecurringFundInsert = { member_code: Member; name: string; amount_cents: number; remark: string | null }`
  - `fanOutRecurring(input: RecurringFundInput): RecurringFundInsert[]`
  - `sumForMember(member: Member, funds: RecurringFund[]): number`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/data/recurring-funds-shared.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { fanOutRecurring, sumForMember, type RecurringFund } from './recurring-funds-shared'

describe('fanOutRecurring', () => {
  it('creates one insert row per selected member', () => {
    const rows = fanOutRecurring({ name: 'House', amountCents: 104500, remark: null, members: ['CH', 'JC'] })
    expect(rows).toEqual([
      { member_code: 'CH', name: 'House', amount_cents: 104500, remark: null },
      { member_code: 'JC', name: 'House', amount_cents: 104500, remark: null },
    ])
  })
  it('supports a single member', () => {
    const rows = fanOutRecurring({ name: 'Food', amountCents: 20000, remark: 'lunch', members: ['CH'] })
    expect(rows).toEqual([{ member_code: 'CH', name: 'Food', amount_cents: 20000, remark: 'lunch' }])
  })
  it('returns empty when no members selected', () => {
    expect(fanOutRecurring({ name: 'X', amountCents: 100, remark: null, members: [] })).toEqual([])
  })
})

describe('sumForMember', () => {
  const funds: RecurringFund[] = [
    { id: '1', memberCode: 'CH', name: 'House', amountCents: 104500, remark: null, sortOrder: 0 },
    { id: '2', memberCode: 'CH', name: 'Food', amountCents: 20000, remark: null, sortOrder: 1 },
    { id: '3', memberCode: 'JC', name: 'House', amountCents: 104500, remark: null, sortOrder: 0 },
  ]
  it('sums only the given member rows', () => {
    expect(sumForMember('CH', funds)).toBe(124500)
    expect(sumForMember('JC', funds)).toBe(104500)
  })
  it('returns 0 when the member has no rows', () => {
    expect(sumForMember('JC', [funds[0]])).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/data/recurring-funds-shared.test.ts`
Expected: FAIL — cannot find module `./recurring-funds-shared`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/data/recurring-funds-shared.ts`:

```ts
// Pure, server/client-safe recurring-fund helpers and types — no supabase import here.
import type { Member } from './types'

export type { Member }
export type RecurringFund = {
  id: string
  memberCode: Member
  name: string
  amountCents: number
  remark: string | null
  sortOrder: number
}
export type RecurringFundInput = {
  name: string
  amountCents: number
  remark: string | null
  members: Member[]
}
export type RecurringFundInsert = {
  member_code: Member
  name: string
  amount_cents: number
  remark: string | null
}

/** Expand one add-form submission into one DB insert row per selected member. */
export function fanOutRecurring(input: RecurringFundInput): RecurringFundInsert[] {
  return input.members.map((member_code) => ({
    member_code,
    name: input.name,
    amount_cents: input.amountCents,
    remark: input.remark,
  }))
}

/** Sum of a member's recurring-fund amounts — the suggested contribution amount. */
export function sumForMember(member: Member, funds: RecurringFund[]): number {
  return funds.filter((f) => f.memberCode === member).reduce((a, f) => a + f.amountCents, 0)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/data/recurring-funds-shared.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/recurring-funds-shared.ts src/lib/data/recurring-funds-shared.test.ts
git commit -m "feat(fund): recurring-funds pure helpers (fanOut, sumForMember)"
```

---

### Task 3: Pure helpers + types (fund records: filtering + totals)

**Files:**
- Modify: `src/lib/data/fund-shared.ts` (append)
- Test: `src/lib/data/fund-shared.test.ts` (create — no test file exists for this module yet)

**Interfaces:**
- Produces (in `fund-shared.ts`):
  - `type FundRecord = { id: string; memberCode: Member; periodISO: string; amountCents: number; notes: string | null }`
  - `type FundFilters = { member: Member | 'all'; month: number | 'all'; year: number }`
  - `periodISOForMonth(year: number, month: number): string` → `'YYYY-MM-01'`
  - `yearOf(periodISO: string): number`, `monthOf(periodISO: string): number`
  - `filterRecords(records: FundRecord[], f: FundFilters): FundRecord[]`
  - `filteredTotal(records: FundRecord[], f: FundFilters): number`
  - `totalContributedThisYear(records: FundRecord[], year: number): number`
- Consumes: `Member` from `./types` (already imported in this file).

- [ ] **Step 1: Write the failing tests**

Create `src/lib/data/fund-shared.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  periodISOForMonth, yearOf, monthOf,
  filterRecords, filteredTotal, totalContributedThisYear,
  type FundRecord,
} from './fund-shared'

const recs: FundRecord[] = [
  { id: 'a', memberCode: 'CH', periodISO: '2026-01-01', amountCents: 293926, notes: null },
  { id: 'b', memberCode: 'JC', periodISO: '2026-01-01', amountCents: 313926, notes: null },
  { id: 'c', memberCode: 'CH', periodISO: '2026-02-01', amountCents: 227000, notes: null },
  { id: 'd', memberCode: 'CH', periodISO: '2025-12-01', amountCents: 66926, notes: null },
]

describe('period helpers', () => {
  it('formats first-of-month ISO with zero padding', () => {
    expect(periodISOForMonth(2026, 3)).toBe('2026-03-01')
    expect(periodISOForMonth(2026, 11)).toBe('2026-11-01')
  })
  it('reads year and month back out', () => {
    expect(yearOf('2026-02-01')).toBe(2026)
    expect(monthOf('2026-02-01')).toBe(2)
  })
})

describe('filterRecords', () => {
  it('defaults (all/all/year) keep only that year, newest first', () => {
    const out = filterRecords(recs, { member: 'all', month: 'all', year: 2026 })
    expect(out.map((r) => r.id)).toEqual(['c', 'a', 'b'])
  })
  it('filters by member', () => {
    const out = filterRecords(recs, { member: 'JC', month: 'all', year: 2026 })
    expect(out.map((r) => r.id)).toEqual(['b'])
  })
  it('filters by month', () => {
    const out = filterRecords(recs, { member: 'all', month: 1, year: 2026 })
    expect(out.map((r) => r.id).sort()).toEqual(['a', 'b'])
  })
  it('filters by year', () => {
    const out = filterRecords(recs, { member: 'CH', month: 'all', year: 2025 })
    expect(out.map((r) => r.id)).toEqual(['d'])
  })
})

describe('totals', () => {
  it('filteredTotal sums the filtered set', () => {
    expect(filteredTotal(recs, { member: 'all', month: 1, year: 2026 })).toBe(293926 + 313926)
  })
  it('totalContributedThisYear sums all records in the year regardless of other filters', () => {
    expect(totalContributedThisYear(recs, 2026)).toBe(293926 + 313926 + 227000)
    expect(totalContributedThisYear(recs, 2025)).toBe(66926)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/data/fund-shared.test.ts`
Expected: FAIL — exports not found.

- [ ] **Step 3: Append the implementation to `fund-shared.ts`**

Add to the end of `src/lib/data/fund-shared.ts`:

```ts
// === Fund records (ledger) — pure filtering + totals ===
export type FundRecord = {
  id: string
  memberCode: Member
  periodISO: string // 'YYYY-MM-01'
  amountCents: number
  notes: string | null
}
export type FundFilters = { member: Member | 'all'; month: number | 'all'; year: number }

export function periodISOForMonth(year: number, month: number): string {
  return `${year}-${pad(month)}-01`
}
export function yearOf(periodISO: string): number {
  return Number(periodISO.slice(0, 4))
}
export function monthOf(periodISO: string): number {
  return Number(periodISO.slice(5, 7))
}

/** Filter by member/month/year, returning newest-first. */
export function filterRecords(records: FundRecord[], f: FundFilters): FundRecord[] {
  return records
    .filter((r) => yearOf(r.periodISO) === f.year)
    .filter((r) => (f.member === 'all' ? true : r.memberCode === f.member))
    .filter((r) => (f.month === 'all' ? true : monthOf(r.periodISO) === f.month))
    .slice()
    .sort((a, b) => (a.periodISO < b.periodISO ? 1 : a.periodISO > b.periodISO ? -1 : 0))
}

/** Sum of records matching the active filters. */
export function filteredTotal(records: FundRecord[], f: FundFilters): number {
  return filterRecords(records, f).reduce((a, r) => a + r.amountCents, 0)
}

/** Sum of every record in the given year, independent of member/month filters. */
export function totalContributedThisYear(records: FundRecord[], year: number): number {
  return records.filter((r) => yearOf(r.periodISO) === year).reduce((a, r) => a + r.amountCents, 0)
}
```

Note: `pad` and `Member` already exist at the top of this file — do not redeclare them.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/data/fund-shared.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/fund-shared.ts src/lib/data/fund-shared.test.ts
git commit -m "feat(fund): fund-record filtering + totals helpers"
```

---

### Task 4: Data layer — recurring funds server functions

**Files:**
- Create: `src/lib/data/recurring-funds.ts`

**Interfaces:**
- Consumes: `RecurringFund`, `RecurringFundInput`, `fanOutRecurring` from `./recurring-funds-shared`; `getMembership` from `./household`; `createClient` from `@/lib/supabase/server`.
- Produces:
  - `listRecurringFunds(): Promise<RecurringFund[]>`
  - `createRecurringFunds(input: RecurringFundInput): Promise<{ ok: boolean; error?: string }>`
  - `updateRecurringFund(id: string, patch: { name: string; amountCents: number; remark: string | null }): Promise<{ ok: boolean; error?: string }>`
  - `deleteRecurringFund(id: string): Promise<{ ok: boolean }>`

- [ ] **Step 1: Write the module**

Create `src/lib/data/recurring-funds.ts`:

```ts
import { createClient } from '@/lib/supabase/server'
import { getMembership } from './household'
import { fanOutRecurring } from './recurring-funds-shared'
import type { RecurringFund, RecurringFundInput } from './recurring-funds-shared'

export { fanOutRecurring, sumForMember } from './recurring-funds-shared'
export type { RecurringFund, RecurringFundInput } from './recurring-funds-shared'

export async function listRecurringFunds(): Promise<RecurringFund[]> {
  const m = await getMembership()
  if (!m) return []
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('recurring_funds')
    .select('id, member_code, name, amount_cents, remark, sort_order')
    .eq('household_id', m.householdId)
    .order('member_code', { ascending: true })
    .order('sort_order', { ascending: true })
  if (error) { console.error('listRecurringFunds:', error.message); return [] }
  return ((data ?? []) as { id: string; member_code: 'CH' | 'JC'; name: string; amount_cents: number; remark: string | null; sort_order: number }[])
    .map((r) => ({ id: r.id, memberCode: r.member_code, name: r.name, amountCents: r.amount_cents, remark: r.remark, sortOrder: r.sort_order }))
}

export async function createRecurringFunds(input: RecurringFundInput): Promise<{ ok: boolean; error?: string }> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }
  if (!input.name.trim()) return { ok: false, error: 'invalid_name' }
  if (!Number.isInteger(input.amountCents) || input.amountCents < 0) return { ok: false, error: 'invalid_amount' }
  if (input.members.length === 0) return { ok: false, error: 'no_members' }
  const supabase = await createClient()
  const rows = fanOutRecurring(input).map((r) => ({ ...r, household_id: m.householdId }))
  const { error } = await supabase.from('recurring_funds').insert(rows)
  if (error) { console.error('createRecurringFunds:', error.message); return { ok: false, error: 'save_failed' } }
  return { ok: true }
}

export async function updateRecurringFund(
  id: string,
  patch: { name: string; amountCents: number; remark: string | null },
): Promise<{ ok: boolean; error?: string }> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }
  if (!patch.name.trim()) return { ok: false, error: 'invalid_name' }
  if (!Number.isInteger(patch.amountCents) || patch.amountCents < 0) return { ok: false, error: 'invalid_amount' }
  const supabase = await createClient()
  const { error } = await supabase
    .from('recurring_funds')
    .update({ name: patch.name, amount_cents: patch.amountCents, remark: patch.remark })
    .eq('id', id).eq('household_id', m.householdId)
  if (error) { console.error('updateRecurringFund:', error.message); return { ok: false, error: 'save_failed' } }
  return { ok: true }
}

export async function deleteRecurringFund(id: string): Promise<{ ok: boolean }> {
  const m = await getMembership()
  if (!m) return { ok: false }
  const supabase = await createClient()
  const { error } = await supabase.from('recurring_funds').delete().eq('id', id).eq('household_id', m.householdId)
  if (error) { console.error('deleteRecurringFund:', error.message); return { ok: false } }
  return { ok: true }
}
```

- [ ] **Step 2: Verify it compiles and lints**

Run: `npm run lint`
Expected: no errors for `recurring-funds.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/recurring-funds.ts
git commit -m "feat(fund): recurring-funds data layer (list/create/update/delete)"
```

---

### Task 5: Data layer — fund record read/write

**Files:**
- Modify: `src/lib/data/fund.ts` (append)

**Interfaces:**
- Consumes: `FundRecord` from `./fund-shared`; `getMembership`, `createClient`.
- Produces:
  - `listFundRecords(): Promise<FundRecord[]>` — all records for the household, newest first.
  - `createFundRecord(input: { memberCode: Member; periodISO: string; amountCents: number; notes: string | null }): Promise<{ ok: boolean; error?: string }>`
  - `updateFundRecord(id: string, patch: { memberCode: Member; periodISO: string; amountCents: number; notes: string | null }): Promise<{ ok: boolean; error?: string }>`
  - `deleteFundRecord(id: string): Promise<{ ok: boolean }>`

- [ ] **Step 1: Append to `fund.ts`**

Add to the end of `src/lib/data/fund.ts`:

```ts
import type { FundRecord } from './fund-shared'
export type { FundRecord }

export async function listFundRecords(): Promise<FundRecord[]> {
  const m = await getMembership()
  if (!m) return []
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('joint_fund_contributions')
    .select('id, member_code, period, amount_cents, notes')
    .eq('household_id', m.householdId)
    .order('period', { ascending: false })
  if (error) { console.error('listFundRecords:', error.message); return [] }
  return ((data ?? []) as { id: string; member_code: Member; period: string; amount_cents: number; notes: string | null }[])
    .map((r) => ({ id: r.id, memberCode: r.member_code, periodISO: r.period, amountCents: r.amount_cents, notes: r.notes }))
}

type FundRecordInput = { memberCode: Member; periodISO: string; amountCents: number; notes: string | null }

function validateFundRecord(input: FundRecordInput): string | null {
  if (input.memberCode !== 'CH' && input.memberCode !== 'JC') return 'invalid_member'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.periodISO)) return 'invalid_period'
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) return 'invalid_amount'
  return null
}

export async function createFundRecord(input: FundRecordInput): Promise<{ ok: boolean; error?: string }> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }
  const invalid = validateFundRecord(input)
  if (invalid) return { ok: false, error: invalid }
  const supabase = await createClient()
  const { error } = await supabase.from('joint_fund_contributions').insert({
    household_id: m.householdId, member_code: input.memberCode, period: input.periodISO,
    amount_cents: input.amountCents, status: 'paid', notes: input.notes,
  })
  if (error) { console.error('createFundRecord:', error.message); return { ok: false, error: 'save_failed' } }
  return { ok: true }
}

export async function updateFundRecord(id: string, patch: FundRecordInput): Promise<{ ok: boolean; error?: string }> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }
  const invalid = validateFundRecord(patch)
  if (invalid) return { ok: false, error: invalid }
  const supabase = await createClient()
  const { error } = await supabase.from('joint_fund_contributions')
    .update({ member_code: patch.memberCode, period: patch.periodISO, amount_cents: patch.amountCents, notes: patch.notes })
    .eq('id', id).eq('household_id', m.householdId)
  if (error) { console.error('updateFundRecord:', error.message); return { ok: false, error: 'save_failed' } }
  return { ok: true }
}

export async function deleteFundRecord(id: string): Promise<{ ok: boolean }> {
  const m = await getMembership()
  if (!m) return { ok: false }
  const supabase = await createClient()
  const { error } = await supabase.from('joint_fund_contributions').delete().eq('id', id).eq('household_id', m.householdId)
  if (error) { console.error('deleteFundRecord:', error.message); return { ok: false } }
  return { ok: true }
}
```

Note: `Member` is already imported at the top of `fund.ts`. Move the `import type { FundRecord }` line up beside the other imports if your linter requires imports at top; the re-export can stay inline.

- [ ] **Step 2: Verify it compiles and lints**

Run: `npm run lint`
Expected: no errors for `fund.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/fund.ts
git commit -m "feat(fund): fund-record data layer (list/create/update/delete)"
```

---

### Task 6: i18n keys

**Files:**
- Modify: `src/i18n/dictionaries.ts` (both `en` and `zh` maps)

**Interfaces:**
- Produces: the `fund.*` and `recurring.*` keys used by Tasks 7–9.

- [ ] **Step 1: Add keys to the `en` map**

In `src/i18n/dictionaries.ts`, next to the existing `'fund.markPaid'` entry in the **en** map, add:

```ts
    'fund.thisYearTotal': 'Contributed this year',
    'fund.filteredTotal': 'Filtered total',
    'fund.manageRecurring': 'Recurring funds',
    'fund.addRecord': 'Add contribution',
    'fund.noRecords': 'No contributions yet',
    'fund.allPersons': 'All',
    'fund.allMonths': 'All months',
    'fund.paidBy': 'Paid by',
    'fund.amount': 'Amount',
    'fund.month': 'Month',
    'fund.year': 'Year',
    'fund.note': 'Note (optional)',
    'fund.editRecord': 'Edit contribution',
    'fund.save': 'Save',
    'fund.delete': 'Delete',
    'fund.deleteConfirm': 'Delete this contribution?',
    'recurring.title': 'Recurring funds',
    'recurring.add': 'Add recurring fund',
    'recurring.edit': 'Edit recurring fund',
    'recurring.name': 'Name',
    'recurring.amount': 'Amount',
    'recurring.remark': 'Remark (optional)',
    'recurring.members': 'Members',
    'recurring.monthlyTotal': 'Monthly total',
    'recurring.empty': 'No recurring funds yet',
    'recurring.deleteConfirm': 'Delete this recurring fund?',
    'error.invalid_name': 'Please enter a name',
    'error.no_members': 'Select at least one member',
```

Note: `error.invalid_amount`, `error.save_failed`, `error.not_authenticated`, `common.back`, `common.close` already exist — do not duplicate. If `error.invalid_amount` etc. are missing in your tree, add them here too.

- [ ] **Step 2: Add the same keys to the `zh` map**

Next to `'fund.markPaid'` in the **zh** map, add:

```ts
    'fund.thisYearTotal': '今年已缴',
    'fund.filteredTotal': '筛选合计',
    'fund.manageRecurring': '定期基金',
    'fund.addRecord': '添加缴款',
    'fund.noRecords': '暂无缴款',
    'fund.allPersons': '全部',
    'fund.allMonths': '所有月份',
    'fund.paidBy': '缴款人',
    'fund.amount': '金额',
    'fund.month': '月份',
    'fund.year': '年份',
    'fund.note': '备注（可选）',
    'fund.editRecord': '编辑缴款',
    'fund.save': '保存',
    'fund.delete': '删除',
    'fund.deleteConfirm': '删除这笔缴款？',
    'recurring.title': '定期基金',
    'recurring.add': '添加定期基金',
    'recurring.edit': '编辑定期基金',
    'recurring.name': '名称',
    'recurring.amount': '金额',
    'recurring.remark': '备注（可选）',
    'recurring.members': '成员',
    'recurring.monthlyTotal': '每月合计',
    'recurring.empty': '暂无定期基金',
    'recurring.deleteConfirm': '删除这个定期基金？',
    'error.invalid_name': '请输入名称',
    'error.no_members': '请至少选择一位成员',
```

- [ ] **Step 3: Verify dictionaries stay parallel**

Run: `npx vitest run src/i18n/dictionaries.test.ts`
Expected: PASS (this test verifies en/zh key parity; if it reports missing keys, add them to the lagging map).

- [ ] **Step 4: Commit**

```bash
git add src/i18n/dictionaries.ts
git commit -m "feat(fund): i18n keys for recurring funds + records ledger"
```

---

### Task 7: Recurring funds management screen

**Files:**
- Create: `src/app/(app)/fund/recurring/page.tsx`
- Create: `src/app/(app)/fund/recurring/RecurringFundsView.tsx`
- Create: `src/app/(app)/fund/recurring/actions.ts`

**Interfaces:**
- Consumes: `listRecurringFunds`, `createRecurringFunds`, `updateRecurringFund`, `deleteRecurringFund`, `sumForMember` from `@/lib/data/recurring-funds`; `RecurringFund` type; `getMembership`.
- Produces: route `/fund/recurring`; server actions `createRecurringAction`, `updateRecurringAction`, `deleteRecurringAction` (all return `{ ok: boolean; error?: string }`).

- [ ] **Step 1: Write the actions**

Create `src/app/(app)/fund/recurring/actions.ts`:

```ts
'use server'
import { createRecurringFunds, updateRecurringFund, deleteRecurringFund } from '@/lib/data/recurring-funds'
import type { Member } from '@/lib/data/types'
import { revalidatePath } from 'next/cache'

export async function createRecurringAction(input: {
  name: string; amountCents: number; remark: string | null; members: Member[]
}): Promise<{ ok: boolean; error?: string }> {
  const res = await createRecurringFunds(input)
  if (res.ok) revalidatePath('/fund/recurring')
  return res
}

export async function updateRecurringAction(
  id: string, patch: { name: string; amountCents: number; remark: string | null },
): Promise<{ ok: boolean; error?: string }> {
  const res = await updateRecurringFund(id, patch)
  if (res.ok) revalidatePath('/fund/recurring')
  return res
}

export async function deleteRecurringAction(id: string): Promise<{ ok: boolean }> {
  const res = await deleteRecurringFund(id)
  if (res.ok) revalidatePath('/fund/recurring')
  return res
}
```

- [ ] **Step 2: Write the page (server component)**

Create `src/app/(app)/fund/recurring/page.tsx`:

```tsx
import { listRecurringFunds } from '@/lib/data/recurring-funds'
import { getMembership } from '@/lib/data/household'
import { RecurringFundsView } from './RecurringFundsView'

export default async function RecurringFundsPage() {
  const [funds, membership] = await Promise.all([listRecurringFunds(), getMembership()])
  const locale = membership?.language ?? 'en'
  return <RecurringFundsView funds={funds} locale={locale} />
}
```

- [ ] **Step 3: Write the view (client component)**

Create `src/app/(app)/fund/recurring/RecurringFundsView.tsx`:

```tsx
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useT } from '@/i18n/LocaleProvider'
import { formatRM, parseMoneyInput } from '@/lib/money'
import { sumForMember } from '@/lib/data/recurring-funds-shared'
import type { RecurringFund, Member } from '@/lib/data/recurring-funds-shared'
import { Card } from '@/components/ui/Card'
import { MemberAvatar } from '@/components/ui/MemberAvatar'
import { MoneyText } from '@/components/ui/MoneyText'
import { createRecurringAction, updateRecurringAction, deleteRecurringAction } from './actions'

const MEMBERS: Member[] = ['CH', 'JC']

export function RecurringFundsView({ funds, locale }: { funds: RecurringFund[]; locale: 'en' | 'zh' }) {
  const t = useT()
  const router = useRouter()
  const [editing, setEditing] = useState<RecurringFund | 'new' | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete(id: string) {
    if (busy || !confirm(t('recurring.deleteConfirm'))) return
    setBusy(true)
    await deleteRecurringAction(id)
    router.refresh()
    setBusy(false)
  }

  return (
    <div className="flex flex-col gap-5 pb-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/fund" aria-label={t('common.back')}
            className="pressable-opacity grid h-11 w-11 place-items-center text-2xl text-[var(--muted)]">‹</Link>
          <h1 className="text-2xl font-extrabold text-[var(--ink-head)]">{t('recurring.title')}</h1>
        </div>
        <button type="button" onClick={() => { setError(null); setEditing('new') }}
          aria-label={t('recurring.add')}
          className="pressable grid h-11 w-11 place-items-center rounded-full bg-[var(--primary)] text-white">
          <Plus size={18} />
        </button>
      </header>

      {MEMBERS.map((mem) => {
        const rows = funds.filter((f) => f.memberCode === mem)
        return (
          <Card key={mem} className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-[var(--hairline)] px-4 py-3">
              <span className="flex items-center gap-2 font-bold text-[var(--ink-head)]">
                <MemberAvatar member={mem} size={28} />{mem}
              </span>
              <span className="text-sm font-bold text-[var(--muted)]">
                {t('recurring.monthlyTotal')} · <MoneyText cents={sumForMember(mem, funds)} />
              </span>
            </div>
            {rows.length === 0 ? (
              <p className="px-4 py-4 text-sm text-[var(--faint)]">{t('recurring.empty')}</p>
            ) : rows.map((f, i) => (
              <div key={f.id}
                className={`flex items-center justify-between gap-3 px-4 py-3 ${i < rows.length - 1 ? 'border-b border-[var(--hairline)]' : ''}`}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-[var(--ink-head)]">{f.name}</p>
                  {f.remark && <p className="truncate text-xs text-[var(--muted)]">{f.remark}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <MoneyText cents={f.amountCents} className="text-sm font-bold" />
                  <button type="button" onClick={() => { setError(null); setEditing(f) }} aria-label={t('recurring.edit')}
                    className="pressable-opacity grid h-9 w-9 place-items-center rounded-full text-[var(--muted)]"><Pencil size={15} /></button>
                  <button type="button" onClick={() => handleDelete(f.id)} aria-label={t('fund.delete')}
                    className="pressable-opacity grid h-9 w-9 place-items-center rounded-full text-[var(--danger)]"><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
          </Card>
        )
      })}

      {editing && (
        <RecurringEditor
          fund={editing === 'new' ? null : editing}
          busy={busy} error={error}
          onCancel={() => setEditing(null)}
          onSubmit={async (payload) => {
            setBusy(true); setError(null)
            const res = editing === 'new'
              ? await createRecurringAction(payload)
              : await updateRecurringAction((editing as RecurringFund).id,
                  { name: payload.name, amountCents: payload.amountCents, remark: payload.remark })
            setBusy(false)
            if (!res.ok) { setError(res.error ?? 'save_failed'); return }
            setEditing(null); router.refresh()
          }}
          t={t}
        />
      )}
    </div>
  )
}

function RecurringEditor({
  fund, busy, error, onCancel, onSubmit, t,
}: {
  fund: RecurringFund | null
  busy: boolean
  error: string | null
  onCancel: () => void
  onSubmit: (p: { name: string; amountCents: number; remark: string | null; members: Member[] }) => void
  t: (k: string) => string
}) {
  const [name, setName] = useState(fund?.name ?? '')
  const [amount, setAmount] = useState(fund ? (fund.amountCents / 100).toString() : '')
  const [remark, setRemark] = useState(fund?.remark ?? '')
  const [members, setMembers] = useState<Member[]>(fund ? [fund.memberCode] : [])
  const isNew = fund === null

  function toggle(mem: Member) {
    setMembers((cur) => (cur.includes(mem) ? cur.filter((x) => x !== mem) : [...cur, mem]))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/30" onClick={onCancel}>
      <div className="mx-auto w-full max-w-[430px] rounded-t-2xl bg-[var(--paper)] p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-bold text-[var(--ink-head)]">{t(isNew ? 'recurring.add' : 'recurring.edit')}</h2>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-[var(--muted)]">{t('recurring.name')}</span>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="min-h-[44px] rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 text-base text-[var(--ink)] outline-none" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-[var(--muted)]">{t('recurring.amount')}</span>
            <input type="number" inputMode="decimal" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
              className="min-h-[44px] rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 text-base text-[var(--ink)] outline-none" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-[var(--muted)]">{t('recurring.remark')}</span>
            <input value={remark} onChange={(e) => setRemark(e.target.value)}
              className="min-h-[44px] rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 text-base text-[var(--ink)] outline-none" />
          </label>
          {isNew && (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-[var(--muted)]">{t('recurring.members')}</span>
              <div className="flex gap-2">
                {MEMBERS.map((mem) => {
                  const on = members.includes(mem)
                  const color = mem === 'CH' ? 'var(--member-ch)' : 'var(--member-jc)'
                  return (
                    <button type="button" key={mem} onClick={() => toggle(mem)}
                      className="pressable flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 font-semibold"
                      style={{ borderColor: on ? color : 'var(--hairline)', background: on ? color : 'var(--surface)', color: on ? 'white' : 'var(--ink)' }}>
                      <MemberAvatar member={mem} size={22} />{mem}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          {error && <p className="text-sm font-semibold text-[var(--danger)]">{t(`error.${error}`)}</p>}
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={onCancel}
              className="pressable flex-1 rounded-xl border border-[var(--hairline)] py-3 font-bold text-[var(--ink)]">{t('common.close')}</button>
            <button type="button" disabled={busy}
              onClick={() => onSubmit({ name: name.trim(), amountCents: parseMoneyInput(amount), remark: remark.trim() || null, members })}
              className="pressable flex-1 rounded-xl bg-[var(--primary-btn)] py-3 font-bold text-white disabled:opacity-40">{t('fund.save')}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Manually verify the screen**

Run: `npm run dev`, sign in, navigate to `/fund/recurring`. Confirm: add a recurring fund with both members selected → two rows appear (one per member); edit one row's amount → only that row changes; delete a row → it disappears; the per-member "Monthly total" updates.

- [ ] **Step 5: Lint + commit**

Run: `npm run lint` (expect no new errors), then:

```bash
git add "src/app/(app)/fund/recurring"
git commit -m "feat(fund): recurring funds management screen"
```

---

### Task 8: Add / edit contribution record form

**Files:**
- Create: `src/app/(app)/fund/record/FundRecordForm.tsx`
- Create: `src/app/(app)/fund/record/add/page.tsx`
- Create: `src/app/(app)/fund/record/edit/[id]/page.tsx`
- Create: `src/app/(app)/fund/record/actions.ts`

**Interfaces:**
- Consumes: `listRecurringFunds`, `sumForMember`; `listFundRecords`, `createFundRecord`, `updateFundRecord` from `@/lib/data/fund`; `periodISOForMonth`, `monthOf`, `yearOf` from `@/lib/data/fund-shared`; `formatRM`, `parseMoneyInput`.
- Produces: routes `/fund/record/add` and `/fund/record/edit/[id]`; server actions `addFundRecordAction(formData)` and `updateFundRecordAction(formData)` (FormData → redirect).

- [ ] **Step 1: Write the actions**

Create `src/app/(app)/fund/record/actions.ts`:

```ts
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
```

- [ ] **Step 2: Write the shared form (client component)**

Create `src/app/(app)/fund/record/FundRecordForm.tsx`:

```tsx
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useT } from '@/i18n/LocaleProvider'
import { formatRM, parseMoneyInput } from '@/lib/money'
import { sumForMember } from '@/lib/data/recurring-funds-shared'
import type { RecurringFund, Member } from '@/lib/data/recurring-funds-shared'
import { MemberAvatar } from '@/components/ui/MemberAvatar'
import { SubmitButton } from '@/components/ui/SubmitButton'

const MEMBERS: Member[] = ['CH', 'JC']

export type FundRecordFormValues = {
  id?: string
  memberCode: Member | null
  year: number
  month: number
  amountCents: number
  notes: string
}

export function FundRecordForm({
  mode, action, error, recurringFunds, initial,
}: {
  mode: 'add' | 'edit'
  action: (formData: FormData) => void
  error?: string
  recurringFunds: RecurringFund[]
  initial: FundRecordFormValues
}) {
  const t = useT()
  const [payer, setPayer] = useState<Member | null>(initial.memberCode)
  // In add mode the amount tracks the payer's recurring sum until the user edits it.
  const [amount, setAmount] = useState(initial.amountCents ? (initial.amountCents / 100).toString() : '')
  const [touched, setTouched] = useState(mode === 'edit')
  const [year, setYear] = useState(initial.year)
  const [month, setMonth] = useState(initial.month)
  const [notes, setNotes] = useState(initial.notes)

  function selectPayer(mem: Member) {
    setPayer(mem)
    if (!touched) setAmount((sumForMember(mem, recurringFunds) / 100).toString())
  }

  const cents = parseMoneyInput(amount)
  const years = [year - 1, year, year + 1].filter((v, i, a) => a.indexOf(v) === i)

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--paper)]">
      <div className="mx-auto flex min-h-0 w-full max-w-[430px] flex-1 flex-col px-[18px] pb-6 pt-4">
        <div className="flex items-center justify-between py-2">
          <Link href="/fund" aria-label={t('common.back')}
            className="pressable-opacity grid h-11 w-11 place-items-center text-2xl text-[var(--muted)]">‹</Link>
          <h1 className="text-base font-bold text-[var(--ink-head)]">{t(mode === 'add' ? 'fund.addRecord' : 'fund.editRecord')}</h1>
          <Link href="/fund" aria-label={t('common.close')}
            className="pressable-opacity grid h-11 w-11 place-items-center text-2xl text-[var(--muted)]">×</Link>
        </div>

        <form action={action} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
          {initial.id && <input type="hidden" name="id" value={initial.id} />}
          <input type="hidden" name="memberCode" value={payer ?? ''} />
          <input type="hidden" name="amountCents" value={cents} />
          <input type="hidden" name="year" value={year} />
          <input type="hidden" name="month" value={month} />
          <input type="hidden" name="notes" value={notes} />

          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-[var(--muted)]">{t('fund.paidBy')}</span>
            <div className="flex gap-2">
              {MEMBERS.map((mem) => {
                const on = payer === mem
                const color = mem === 'CH' ? 'var(--member-ch)' : 'var(--member-jc)'
                return (
                  <button type="button" key={mem} onClick={() => selectPayer(mem)}
                    className="pressable flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 font-semibold"
                    style={{ borderColor: on ? color : 'var(--hairline)', background: on ? color : 'var(--surface)', color: on ? 'white' : 'var(--ink)' }}>
                    <MemberAvatar member={mem} size={22} />{mem}
                  </button>
                )
              })}
            </div>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-[var(--muted)]">{t('fund.amount')}</span>
            <input type="number" inputMode="decimal" step="0.01" value={amount}
              onChange={(e) => { setTouched(true); setAmount(e.target.value) }}
              className="min-h-[44px] rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 text-base text-[var(--ink)] outline-none" />
            <span className="text-xs text-[var(--faint)]">{formatRM(cents)}</span>
          </label>

          <div className="flex gap-2">
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-xs font-semibold text-[var(--muted)]">{t('fund.month')}</span>
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
                className="min-h-[44px] rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-3 text-base text-[var(--ink)] outline-none">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((mo) => (
                  <option key={mo} value={mo}>{mo}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-xs font-semibold text-[var(--muted)]">{t('fund.year')}</span>
              <select value={year} onChange={(e) => setYear(Number(e.target.value))}
                className="min-h-[44px] rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-3 text-base text-[var(--ink)] outline-none">
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-[var(--muted)]">{t('fund.note')}</span>
            <input value={notes} onChange={(e) => setNotes(e.target.value)}
              className="min-h-[44px] rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 text-base text-[var(--ink)] outline-none" />
          </label>

          {error && <p className="text-sm font-semibold text-[var(--danger)]">{t(`error.${error}`)}</p>}

          <div className="mt-auto pt-2">
            <SubmitButton disabled={!payer || cents <= 0}
              className="w-full rounded-xl bg-[var(--primary-btn)] py-3.5 font-bold text-white disabled:opacity-40">
              {t('fund.save')}
            </SubmitButton>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Write the add route**

Create `src/app/(app)/fund/record/add/page.tsx`:

```tsx
import { listRecurringFunds } from '@/lib/data/recurring-funds'
import { FundRecordForm } from '../FundRecordForm'
import { addFundRecordAction } from '../actions'

export default async function AddFundRecordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const recurringFunds = await listRecurringFunds()
  const now = new Date()
  return (
    <FundRecordForm
      mode="add"
      action={addFundRecordAction}
      error={error}
      recurringFunds={recurringFunds}
      initial={{ memberCode: null, year: now.getFullYear(), month: now.getMonth() + 1, amountCents: 0, notes: '' }}
    />
  )
}
```

- [ ] **Step 4: Write the edit route**

Create `src/app/(app)/fund/record/edit/[id]/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { listFundRecords } from '@/lib/data/fund'
import { listRecurringFunds } from '@/lib/data/recurring-funds'
import { monthOf, yearOf } from '@/lib/data/fund-shared'
import { FundRecordForm } from '../../FundRecordForm'
import { updateFundRecordAction } from '../../actions'

export default async function EditFundRecordPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams
  const [records, recurringFunds] = await Promise.all([listFundRecords(), listRecurringFunds()])
  const rec = records.find((r) => r.id === id)
  if (!rec) redirect('/fund')
  return (
    <FundRecordForm
      mode="edit"
      action={updateFundRecordAction}
      error={error}
      recurringFunds={recurringFunds}
      initial={{
        id: rec.id, memberCode: rec.memberCode,
        year: yearOf(rec.periodISO), month: monthOf(rec.periodISO),
        amountCents: rec.amountCents, notes: rec.notes ?? '',
      }}
    />
  )
}
```

- [ ] **Step 5: Manually verify add + edit**

Run: `npm run dev`. From `/fund/record/add`: pick CH → amount pre-fills with CH's recurring sum; change payer to JC → amount updates to JC's sum (since untouched); type a custom amount → it stays; pick month/year, save → redirect to `/fund`. Then open an existing record's edit route → fields prefilled, amount does NOT auto-change on load; save updates it.

- [ ] **Step 6: Lint + commit**

Run: `npm run lint`, then:

```bash
git add "src/app/(app)/fund/record"
git commit -m "feat(fund): add/edit contribution record form + actions"
```

---

### Task 9: Rework the Fund screen (records ledger)

**Files:**
- Rewrite: `src/app/(app)/fund/page.tsx`
- Rewrite: `src/app/(app)/fund/FundView.tsx`
- Modify: `src/app/(app)/fund/actions.ts` (add `deleteFundRecordAction`)

**Interfaces:**
- Consumes: `listFundRecords` from `@/lib/data/fund`; `getFundConfig` (kept for the coexisting config editor); `filterRecords`, `filteredTotal`, `totalContributedThisYear`, `type FundRecord`, `type FundFilters` from `@/lib/data/fund-shared`; `deleteFundRecord` from `@/lib/data/fund`.
- Produces: reworked `/fund`; `deleteFundRecordAction(id)` returning `{ ok: boolean }`.

- [ ] **Step 1: Add the delete action**

Append to `src/app/(app)/fund/actions.ts`:

```ts
import { deleteFundRecord } from '@/lib/data/fund'

export async function deleteFundRecordAction(id: string): Promise<{ ok: boolean }> {
  const res = await deleteFundRecord(id)
  if (res.ok) { revalidatePath('/fund'); revalidatePath('/') }
  return res
}
```

(`revalidatePath` and the `'use server'` directive already exist at the top of this file.)

- [ ] **Step 2: Rewrite the page (server component)**

Replace `src/app/(app)/fund/page.tsx` with:

```tsx
import { listFundRecords, getFundConfig } from '@/lib/data/fund'
import { getMembership } from '@/lib/data/household'
import { FundView } from './FundView'

export default async function FundPage() {
  const currentYear = new Date().getFullYear()
  const [records, membership, config] = await Promise.all([
    listFundRecords(), getMembership(), getFundConfig(),
  ])
  const locale = membership?.language ?? 'en'
  return <FundView records={records} currentYear={currentYear} locale={locale} config={config} />
}
```

- [ ] **Step 3: Rewrite the view (client component)**

Replace `src/app/(app)/fund/FundView.tsx` with:

```tsx
'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, Repeat, SlidersHorizontal } from 'lucide-react'
import { useT } from '@/i18n/LocaleProvider'
import { monthShort } from '@/lib/data/summary'
import {
  filterRecords, filteredTotal, totalContributedThisYear,
  type FundRecord, type FundFilters,
} from '@/lib/data/fund-shared'
import type { Member } from '@/lib/data/types'
import { Card, HeroCard } from '@/components/ui/Card'
import { MemberAvatar } from '@/components/ui/MemberAvatar'
import { MoneyText } from '@/components/ui/MoneyText'
import type { FundConfig } from '@/lib/data/fund'
import { FundConfigEditor } from './FundConfigEditor'
import { deleteFundRecordAction } from './actions'

const MEMBERS: Member[] = ['CH', 'JC']

export function FundView({
  records, currentYear, locale, config,
}: {
  records: FundRecord[]
  currentYear: number
  locale: 'en' | 'zh'
  config: FundConfig
}) {
  const t = useT()
  const router = useRouter()
  const [editingConfig, setEditingConfig] = useState(false)
  const [busy, setBusy] = useState(false)
  const [filters, setFilters] = useState<FundFilters>({ member: 'all', month: 'all', year: currentYear })

  const years = useMemo(() => {
    const set = new Set<number>(records.map((r) => Number(r.periodISO.slice(0, 4))))
    set.add(currentYear)
    return Array.from(set).sort((a, b) => b - a)
  }, [records, currentYear])

  const shown = useMemo(() => filterRecords(records, filters), [records, filters])
  const shownTotal = useMemo(() => filteredTotal(records, filters), [records, filters])
  const yearTotal = useMemo(() => totalContributedThisYear(records, currentYear), [records, currentYear])

  async function handleDelete(id: string) {
    if (busy || !confirm(t('fund.deleteConfirm'))) return
    setBusy(true)
    await deleteFundRecordAction(id)
    router.refresh()
    setBusy(false)
  }

  return (
    <div className="flex flex-col gap-5 pb-28">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-[var(--ink-head)]">{t('fund.title')}</h1>
        <div className="flex items-center gap-1">
          <Link href="/fund/recurring" aria-label={t('fund.manageRecurring')}
            className="pressable-opacity grid h-11 w-11 place-items-center rounded-full text-[var(--muted)]">
            <Repeat size={18} />
          </Link>
          <button type="button" onClick={() => setEditingConfig((v) => !v)} aria-label={t('fund.editConfig')}
            aria-expanded={editingConfig}
            className="pressable-opacity grid h-11 w-11 place-items-center rounded-full text-[var(--muted)]">
            <SlidersHorizontal size={16} />
          </button>
        </div>
      </header>

      {editingConfig && <FundConfigEditor config={config} onClose={() => setEditingConfig(false)} />}

      <HeroCard>
        <span className="text-sm font-bold opacity-90">{t('fund.thisYearTotal')}</span>
        <div className="mt-1"><MoneyText cents={yearTotal} className="text-[32px] font-extrabold" /></div>
        <p className="mt-2 flex items-center gap-1 text-sm font-semibold opacity-80">
          {t('fund.filteredTotal')} · <MoneyText cents={shownTotal} />
        </p>
      </HeroCard>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <FilterSelect label={t('fund.paidBy')} value={String(filters.member)}
          onChange={(v) => setFilters((f) => ({ ...f, member: v === 'all' ? 'all' : (v as Member) }))}
          options={[{ v: 'all', label: t('fund.allPersons') }, ...MEMBERS.map((m) => ({ v: m, label: m }))]} />
        <FilterSelect label={t('fund.month')} value={String(filters.month)}
          onChange={(v) => setFilters((f) => ({ ...f, month: v === 'all' ? 'all' : Number(v) }))}
          options={[{ v: 'all', label: t('fund.allMonths') },
            ...Array.from({ length: 12 }, (_, i) => ({ v: String(i + 1), label: monthShort(i + 1, locale) }))]} />
        <FilterSelect label={t('fund.year')} value={String(filters.year)}
          onChange={(v) => setFilters((f) => ({ ...f, year: Number(v) }))}
          options={years.map((y) => ({ v: String(y), label: String(y) }))} />
      </div>

      <Card className="overflow-hidden p-0">
        {shown.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[var(--faint)]">{t('fund.noRecords')}</p>
        ) : shown.map((r, i) => (
          <div key={r.id}
            className={`flex items-center justify-between gap-3 px-4 py-3 ${i < shown.length - 1 ? 'border-b border-[var(--hairline)]' : ''}`}>
            <div className="flex min-w-0 items-center gap-3">
              <MemberAvatar member={r.memberCode} size={32} />
              <div className="min-w-0">
                <p className="text-sm font-bold text-[var(--ink-head)]">
                  {monthShort(Number(r.periodISO.slice(5, 7)), locale)} {r.periodISO.slice(0, 4)}
                </p>
                {r.notes && <p className="truncate text-xs text-[var(--muted)]">{r.notes}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <MoneyText cents={r.amountCents} className="text-sm font-bold" />
              <Link href={`/fund/record/edit/${r.id}`} aria-label={t('fund.editRecord')}
                className="pressable-opacity grid h-9 w-9 place-items-center rounded-full text-[var(--muted)]"><Pencil size={15} /></Link>
              <button type="button" onClick={() => handleDelete(r.id)} aria-label={t('fund.delete')}
                className="pressable-opacity grid h-9 w-9 place-items-center rounded-full text-[var(--danger)]"><Trash2 size={15} /></button>
            </div>
          </div>
        ))}
      </Card>

      {/* FAB — mirrors the expenses screen */}
      <Link href="/fund/record/add" aria-label={t('fund.addRecord')}
        className="pressable fixed bottom-[100px] left-1/2 grid h-14 w-14 -translate-x-1/2 place-items-center rounded-full bg-[var(--primary)] text-white shadow-lg"
        style={{ marginLeft: 'min(0px, calc((100vw - 430px) / 2 * -1))' }}>
        <Plus size={26} />
      </Link>
    </div>
  )
}

function FilterSelect({
  label, value, onChange, options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { v: string; label: string }[]
}) {
  return (
    <label className="flex items-center gap-1 rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--ink)]">
      <span className="text-[var(--muted)]">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="bg-transparent font-bold text-[var(--ink)] outline-none">
        {options.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
      </select>
    </label>
  )
}
```

Note on the FAB centering: the app shell is `max-w-[430px]` centered. If the simple `left-1/2 -translate-x-1/2` with the `marginLeft` clamp looks off during manual testing, match the exact positioning the expenses FAB uses in `ExpensesView.tsx` (read it and copy the same wrapper/classes). The functional requirement is: fixed, bottom-right-ish, above the tab bar, list padded with `pb-28` to clear it.

- [ ] **Step 4: Verify existing fund helper tests still pass**

Run: `npx vitest run src/lib/data/fund.test.ts src/lib/data/fund-shared.test.ts`
Expected: PASS. (The old `getFundOverview` / `collapseLeadingPaid` are untouched and still exported.)

- [ ] **Step 5: Manually verify the reworked screen end-to-end**

Run: `npm run dev`. On `/fund`: confirm the header shows "Contributed this year" (sum of 2026 records incl. the topped-up Jan values) and a "Filtered total" that changes as you change filters; the records list shows real records newest-first; filters default to All person / All months / current year; the Recurring-funds button (top-right) opens `/fund/recurring`; the config icon still opens the existing editor; the FAB opens `/fund/record/add`; editing a row opens its edit route; deleting a row (with confirm) removes it.

- [ ] **Step 6: Lint + commit**

Run: `npm run lint`, then:

```bash
git add "src/app/(app)/fund/page.tsx" "src/app/(app)/fund/FundView.tsx" "src/app/(app)/fund/actions.ts"
git commit -m "feat(fund): rework Fund screen into filterable records ledger"
```

---

### Task 10: Full-suite verification

**Files:** none (verification only)

- [ ] **Step 1: Run the whole test suite**

Run: `npm test`
Expected: all tests PASS, including the new `recurring-funds-shared.test.ts` and `fund-shared.test.ts`.

- [ ] **Step 2: Lint the whole project**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds (Server/Client component boundaries and the new routes compile).

- [ ] **Step 4: Final manual smoke test**

With `npm run dev`: exercise the full flow once more — create a recurring fund for both members, add a contribution using the suggested amount, edit it, filter the list, delete it. Confirm no console errors.

- [ ] **Step 5: Commit any final fixes** (if Steps 1–4 surfaced issues)

```bash
git add -A
git commit -m "fix(fund): address verification findings"
```

---

## Self-Review Notes

- **Spec coverage:** recurring_funds table + RLS (Task 1); recurring pure helpers (Task 2); fund-record filtering/totals (Task 3); recurring data layer with fan-out (Task 4); fund-record data layer with snapshot amounts (Task 5); i18n (Task 6); management screen reached by top-right button, multi-select fan-out, per-member monthly total (Task 7); add/edit with payer-sum suggestion + editable amount + month/year→1st + note (Task 8); reworked screen with this-year total, filtered total, person/month/year filters (default all/all/current year), records list, FAB add, edit+delete, coexisting config icon (Task 9); verification (Task 10). `joint_fund_config`/Budget left untouched per spec.
- **Snapshot behavior:** records store their own `amount_cents`; editing/deleting a recurring fund never rewrites saved records (nothing in the data layer reads recurring funds when rendering records). ✓
- **Type consistency:** `Member`, `RecurringFund`, `RecurringFundInput`, `RecurringFundInsert`, `FundRecord`, `FundFilters`, `sumForMember`, `fanOutRecurring`, `filterRecords`, `filteredTotal`, `totalContributedThisYear`, `periodISOForMonth`, `monthOf`, `yearOf` are named identically across all tasks.
- **Import sources:** `listFundRecords`/`createFundRecord`/`updateFundRecord`/`deleteFundRecord` come from `@/lib/data/fund`; `listRecurringFunds`/`sumForMember`/`fanOutRecurring` from `@/lib/data/recurring-funds` (or the `-shared` module for the pure ones). No cross-module re-export is assumed.
