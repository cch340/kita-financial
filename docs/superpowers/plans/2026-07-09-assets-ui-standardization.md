# Assets UI Standardization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the four per-type asset body components with one uniform, config-free `AssetBody`, and introduce a user-managed per-asset-type transaction category model.

**Architecture:** The `assets`/`asset_transactions` tables already carry a `type` discriminator; only presentation forks today. This work removes the fork: one `AssetBody` renders every type identically (Balance hero → Commitments → collapsible category groups → rows). Free-text `txn_type` is replaced by an `asset_categories` table (scoped per household + asset type) referenced from `asset_transactions.category_id` with `ON DELETE SET NULL`, so deleting a category drops its transactions into an "Other" group.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind 4, Supabase (Postgres + RLS), TypeScript, vitest + jsdom.

## Global Constraints

- **Money is integer cents** everywhere; format only at the edge with `formatRM` / `MoneyText`. Never floats.
- **All Supabase access goes through the anon client** (`@/lib/supabase/server`) so RLS applies; every query filters by `householdId` from `getMembership()`.
- **Data-layer split:** pure, framework-free logic + types live in `*-shared.ts` (client-safe, unit-tested); server-only Supabase reads live in `<domain>.ts`.
- **Server Actions** are `'use server'`, colocated with their screen; they call a data-layer function then `revalidatePath(...)`.
- **i18n:** every user-facing string is a key in `src/i18n/dictionaries.ts` with **both** `en` and `zh` entries; look up via `t(locale, key)` (server) or `useT()` (client).
- **Migrations are applied manually** in the Supabase SQL editor — there is no local Postgres/migration tooling. New schema = a new numbered file in `supabase/migrations/`.
- **Tests:** vitest, colocated `*.test.ts`; run with `npm test`. `@/` maps to `src/`.
- **Verification per task:** `npm test` (if tests touched), `npm run lint`, and `npx tsc --noEmit` must pass before commit.

---

## File map

**Create**
- `supabase/migrations/0003_asset_categories.sql` — new table, `category_id` column, RLS, backfill.
- `src/lib/data/categories.ts` — server reads for categories.
- `src/app/(app)/assets/categories/actions.ts` — category CRUD server actions.
- `src/app/(app)/assets/categories/page.tsx` — manager screen (server).
- `src/app/(app)/assets/categories/CategoriesManager.tsx` — manager UI (client).
- `src/app/(app)/assets/[id]/AssetBody.tsx` — the single unified body (client).

**Modify**
- `src/lib/data/assets-shared.ts` — types (`AssetTxn`, `AssetCategory`, `TxnInput`, `KeyFigure`, `CategoryGroup`), `groupByCategory`, collapse `assetKeyFigure`, drop dead helpers.
- `src/lib/data/assets-shared.test.ts` — update for the above.
- `src/lib/data/assets.ts` — `TXN_COLS`, `mapTxn`, `getAsset` (return categories), `getAssetsList`.
- `src/app/(app)/assets/actions.ts` — `addAssetTransaction`/`updateAssetTransaction` use `categoryId`; remove `toggleTransferred`.
- `src/app/(app)/assets/[id]/page.tsx` — render `AssetBody`, fetch commitments for all types.
- `src/app/(app)/assets/[id]/AddTxn.tsx` — category picker + inline add.
- `src/app/(app)/assets/[id]/txn/[txnId]/EditTxnForm.tsx` — category picker, drop settled toggle.
- `src/app/(app)/assets/page.tsx` — "Manage" button in header.
- `src/i18n/dictionaries.ts` — add/remove keys (en + zh).

**Delete**
- `src/app/(app)/assets/[id]/PropertyBody.tsx`
- `src/app/(app)/assets/[id]/VehicleBody.tsx`
- `src/app/(app)/assets/[id]/InvestmentBody.tsx`

---

## Task 1: Database migration — categories table, `category_id`, RLS, backfill

**Files:**
- Create: `supabase/migrations/0003_asset_categories.sql`

**Interfaces:**
- Produces: table `asset_categories(id, household_id, asset_type, name, sort_order, created_at)`; column `asset_transactions.category_id uuid` (FK, `on delete set null`); RLS policy `ac_all`.

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/0003_asset_categories.sql`:

```sql
-- === Asset transaction categories (user-managed, scoped per household + asset type) ===
create table asset_categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  asset_type text not null check (asset_type in ('property','vehicle','investment','other')),
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index on asset_categories (household_id, asset_type, sort_order);

-- Link transactions to a category. ON DELETE SET NULL => deleting a category
-- moves its transactions to the "Other" (uncategorised) group.
alter table asset_transactions
  add column category_id uuid references asset_categories(id) on delete set null;
create index on asset_transactions (category_id);

-- RLS: household-scoped, same pattern as every other table.
alter table asset_categories enable row level security;
create policy ac_all on asset_categories
  for all using (is_member(household_id)) with check (is_member(household_id));

-- Backfill: one category per distinct (household, asset_type, txn_type); map transactions to it.
insert into asset_categories (household_id, asset_type, name, sort_order)
select distinct a.household_id, a.type,
       initcap(replace(t.txn_type, '_', ' ')) as name,
       0
from asset_transactions t
join assets a on a.id = t.asset_id
where t.txn_type is not null and t.txn_type <> '';

update asset_transactions t
set category_id = c.id
from assets a, asset_categories c
where t.asset_id = a.id
  and c.household_id = a.household_id
  and c.asset_type = a.type
  and c.name = initcap(replace(t.txn_type, '_', ' '))
  and t.txn_type is not null and t.txn_type <> '';
```

- [ ] **Step 2: Apply it in the Supabase SQL editor**

Open the Supabase dashboard → SQL editor → paste the file contents → Run. (Per repo convention there is no CLI migration runner.)

- [ ] **Step 3: Verify in the SQL editor**

Run and confirm no errors, and that existing vehicle transactions got categories:

```sql
select asset_type, name, count(*) from asset_categories group by 1,2 order by 1,2;
select count(*) as mapped from asset_transactions where category_id is not null;
```
Expected: category rows for each distinct old `txn_type` (e.g. "Loan", "Maintenance"); `mapped` equals the number of transactions that had a non-empty `txn_type`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0003_asset_categories.sql
git commit -m "feat(assets): add asset_categories table + category_id column + RLS"
```

---

## Task 2: Shared types & pure helpers (`assets-shared.ts`)

**Files:**
- Modify: `src/lib/data/assets-shared.ts`
- Test: `src/lib/data/assets-shared.test.ts`

**Interfaces:**
- Produces:
  - `type AssetTxn = { id: string; date: string; description: string | null; amountCents: number; direction: 'in' | 'out'; categoryId: string | null; notes: string | null }`
  - `type AssetCategory = { id: string; assetType: AssetType; name: string; sortOrder: number }`
  - `type CategoryGroup = { categoryId: string | null; name: string; rows: AssetTxn[]; subtotalCents: number }`
  - `type KeyFigure = { label: 'balance'; amountCents: number }`
  - `type TxnInput = { date: string; description: string | null; amountCents: number; direction: 'in' | 'out'; categoryId: string | null; notes: string | null }`
  - `runningBalanceCents(openingCents, txns)` (unchanged)
  - `assetKeyFigure(asset, txns): KeyFigure` (always balance)
  - `groupByCategory(txns, categories, otherLabel): CategoryGroup[]`
  - `validateTxnInput(input): { ok: true } | { ok: false; error: string }` (unchanged logic)
  - `splitByStatus` (unchanged)
- Removed: `AssetTxn.txnType/settled/seq`, `totalSettledOutCents`, `nextPaymentCents`, `groupByTxnType`.

- [ ] **Step 1: Rewrite the test file**

Replace `src/lib/data/assets-shared.test.ts` with:

```ts
import { describe, it, expect } from 'vitest'
import { runningBalanceCents, assetKeyFigure, groupByCategory, validateTxnInput, splitByStatus, type TxnInput, type AssetCategory } from './assets-shared'
import type { AssetTxn, Asset } from './assets-shared'

const tx = (p: Partial<AssetTxn>): AssetTxn => ({
  id: p.id ?? 'x', date: p.date ?? '2026-01-01', description: p.description ?? null,
  amountCents: p.amountCents ?? 0, direction: p.direction ?? 'out',
  categoryId: p.categoryId ?? null, notes: p.notes ?? null,
})
const cat = (id: string, sortOrder: number, name = id): AssetCategory => ({ id, assetType: 'vehicle', name, sortOrder })

describe('runningBalanceCents', () => {
  it('opening + in - out', () => {
    expect(runningBalanceCents(100000, [tx({ direction: 'in', amountCents: 5000 }), tx({ direction: 'out', amountCents: 2000 })])).toBe(103000)
    expect(runningBalanceCents(null, [])).toBe(0)
  })
})

describe('assetKeyFigure', () => {
  const base: Asset = { id: 'a', type: 'property', name: 'T', ownerMemberCode: null, status: 'active', openingBalanceCents: 100000, metadata: {} }
  it('always returns balance for every type', () => {
    expect(assetKeyFigure(base, [tx({ direction: 'in', amountCents: 5000 })])).toEqual({ label: 'balance', amountCents: 105000 })
    expect(assetKeyFigure({ ...base, type: 'vehicle', openingBalanceCents: null }, [tx({ direction: 'out', amountCents: 2000 })])).toEqual({ label: 'balance', amountCents: -2000 })
  })
})

describe('groupByCategory', () => {
  const cats = [cat('c1', 2, 'Loan'), cat('c2', 1, 'Maintenance')]
  it('orders groups by category sortOrder and sums magnitudes', () => {
    const g = groupByCategory(
      [tx({ categoryId: 'c1', amountCents: 100 }), tx({ categoryId: 'c2', amountCents: 40 }), tx({ categoryId: 'c1', amountCents: 200 })],
      cats, 'Other',
    )
    expect(g.map((x) => x.name)).toEqual(['Maintenance', 'Loan'])
    expect(g[1].rows).toHaveLength(2)
    expect(g[1].subtotalCents).toBe(300)
  })
  it('puts null and unknown category rows into a trailing Other group', () => {
    const g = groupByCategory(
      [tx({ categoryId: 'c1', amountCents: 100 }), tx({ categoryId: null, amountCents: 50 }), tx({ categoryId: 'gone', amountCents: 25 })],
      cats, 'Other',
    )
    expect(g.map((x) => x.name)).toEqual(['Loan', 'Other'])
    expect(g[1].categoryId).toBeNull()
    expect(g[1].subtotalCents).toBe(75)
  })
  it('omits categories with no rows and returns [] for no txns', () => {
    expect(groupByCategory([], cats, 'Other')).toEqual([])
    const g = groupByCategory([tx({ categoryId: 'c1', amountCents: 100 })], cats, 'Other')
    expect(g).toHaveLength(1)
  })
})

describe('validateTxnInput', () => {
  const base: TxnInput = { date: '2026-07-05', description: 'Bill', amountCents: 5000, direction: 'out', categoryId: null, notes: null }
  it('accepts a valid txn', () => { expect(validateTxnInput(base)).toEqual({ ok: true }) })
  it('rejects a bad date', () => { expect(validateTxnInput({ ...base, date: 'nope' })).toEqual({ ok: false, error: 'invalid_date' }) })
  it('rejects a non-positive amount', () => { expect(validateTxnInput({ ...base, amountCents: 0 })).toEqual({ ok: false, error: 'invalid_amount' }) })
  it('rejects a bad direction', () => { expect(validateTxnInput({ ...base, direction: 'sideways' as unknown as 'in' })).toEqual({ ok: false, error: 'invalid_direction' }) })
})

describe('splitByStatus', () => {
  it('partitions active and closed preserving order', () => {
    const items = [{ id: '1', status: 'active' as const }, { id: '2', status: 'closed' as const }, { id: '3', status: 'active' as const }]
    const { active, closed } = splitByStatus(items)
    expect(active.map((a) => a.id)).toEqual(['1', '3'])
    expect(closed.map((a) => a.id)).toEqual(['2'])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/data/assets-shared.test.ts`
Expected: FAIL — `groupByCategory` is not exported, `AssetTxn` still requires `txnType`, etc.

- [ ] **Step 3: Rewrite `assets-shared.ts`**

Replace the entire contents of `src/lib/data/assets-shared.ts` with:

```ts
// Pure, server/client-safe asset helpers and types — no supabase import here.
// Kept separate from assets.ts so client components can import these without
// pulling in `next/headers` (via createClient) through getAssetsList/getAsset.
export type AssetType = 'property' | 'vehicle' | 'investment' | 'other'
export type AssetTxn = {
  id: string; date: string; description: string | null; amountCents: number
  direction: 'in' | 'out'; categoryId: string | null; notes: string | null
}
export type Asset = {
  id: string; type: AssetType; name: string; ownerMemberCode: 'CH' | 'JC' | null
  status: 'active' | 'closed'; openingBalanceCents: number | null; metadata: Record<string, unknown>
}
export type AssetCategory = { id: string; assetType: AssetType; name: string; sortOrder: number }
export type CategoryGroup = { categoryId: string | null; name: string; rows: AssetTxn[]; subtotalCents: number }
export type KeyFigure = { label: 'balance'; amountCents: number }

export function runningBalanceCents(openingCents: number | null, txns: AssetTxn[]): number {
  return (openingCents ?? 0) + txns.reduce((a, t) => a + (t.direction === 'in' ? t.amountCents : -t.amountCents), 0)
}

// Every asset type shows the same figure: a running balance.
export function assetKeyFigure(asset: Asset, txns: AssetTxn[]): KeyFigure {
  return { label: 'balance', amountCents: runningBalanceCents(asset.openingBalanceCents, txns) }
}

// Group transactions by category, ordered by each category's sortOrder. Rows whose
// categoryId is null or references an unknown category collapse into a single trailing
// "Other" group. subtotalCents is the sum of transaction magnitudes in the group.
export function groupByCategory(txns: AssetTxn[], categories: AssetCategory[], otherLabel: string): CategoryGroup[] {
  const known = new Set(categories.map((c) => c.id))
  const byId = new Map<string, AssetTxn[]>()
  const other: AssetTxn[] = []
  for (const t of txns) {
    if (t.categoryId && known.has(t.categoryId)) {
      const list = byId.get(t.categoryId) ?? []
      list.push(t); byId.set(t.categoryId, list)
    } else {
      other.push(t)
    }
  }
  const sum = (rows: AssetTxn[]) => rows.reduce((a, r) => a + r.amountCents, 0)
  const groups: CategoryGroup[] = []
  for (const c of [...categories].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const rows = byId.get(c.id)
    if (rows && rows.length) groups.push({ categoryId: c.id, name: c.name, rows, subtotalCents: sum(rows) })
  }
  if (other.length) groups.push({ categoryId: null, name: otherLabel, rows: other, subtotalCents: sum(other) })
  return groups
}

export type TxnInput = {
  date: string
  description: string | null
  amountCents: number
  direction: 'in' | 'out'
  categoryId: string | null
  notes: string | null
}

const TXN_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function validateTxnInput(input: TxnInput): { ok: true } | { ok: false; error: string } {
  if (!TXN_DATE_RE.test(input.date)) return { ok: false, error: 'invalid_date' }
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) return { ok: false, error: 'invalid_amount' }
  if (input.direction !== 'in' && input.direction !== 'out') return { ok: false, error: 'invalid_direction' }
  return { ok: true }
}

export function splitByStatus<T extends { status: 'active' | 'closed' }>(assets: T[]): { active: T[]; closed: T[] } {
  return {
    active: assets.filter((a) => a.status === 'active'),
    closed: assets.filter((a) => a.status === 'closed'),
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/data/assets-shared.test.ts`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/assets-shared.ts src/lib/data/assets-shared.test.ts
git commit -m "feat(assets): shared category types + groupByCategory; collapse key figure to balance"
```

---

## Task 3: Assets data layer (`assets.ts`)

**Files:**
- Modify: `src/lib/data/assets.ts`

**Interfaces:**
- Consumes: `AssetTxn`, `AssetCategory`, `assetKeyFigure` (Task 2).
- Produces: `getAsset(id): Promise<{ asset: Asset; txns: AssetTxn[]; categories: AssetCategory[] } | null>`; `getAssetsList()` unchanged signature.

- [ ] **Step 1: Rewrite `assets.ts`**

Replace the entire contents of `src/lib/data/assets.ts` with:

```ts
import { createClient } from '@/lib/supabase/server'
import { getMembership } from './household'
import { assetKeyFigure, type Asset, type AssetTxn, type AssetType, type AssetCategory, type KeyFigure } from './assets-shared'

const TYPE_ORDER: AssetType[] = ['property', 'vehicle', 'investment', 'other']
const ASSET_COLS = 'id, type, name, owner_member_code, status, opening_balance_cents, metadata'
const TXN_COLS = 'id, date, description, amount_cents, direction, category_id, notes'
// Template literal (not `+` concatenation) keeps this in sync with TXN_COLS while
// preserving the literal type Supabase needs to infer the select's row shape.
const TXN_COLS_WITH_ASSET = `asset_id, ${TXN_COLS}` as const
const CAT_COLS = 'id, asset_type, name, sort_order'

function mapAsset(r: Record<string, unknown>): Asset {
  return {
    id: r.id as string, type: r.type as AssetType, name: r.name as string,
    ownerMemberCode: (r.owner_member_code as 'CH' | 'JC' | null) ?? null,
    status: r.status as 'active' | 'closed', openingBalanceCents: (r.opening_balance_cents as number | null) ?? null,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
  }
}
function mapTxn(r: Record<string, unknown>): AssetTxn {
  return {
    id: r.id as string, date: r.date as string, description: (r.description as string | null) ?? null,
    amountCents: r.amount_cents as number, direction: r.direction as 'in' | 'out',
    categoryId: (r.category_id as string | null) ?? null, notes: (r.notes as string | null) ?? null,
  }
}
function mapCategory(r: Record<string, unknown>): AssetCategory {
  return {
    id: r.id as string, assetType: r.asset_type as AssetType,
    name: r.name as string, sortOrder: r.sort_order as number,
  }
}

export async function getAssetsList(): Promise<{ type: AssetType; assets: (Asset & { key: KeyFigure })[] }[]> {
  const m = await getMembership()
  if (!m) return []
  const supabase = await createClient()
  const [assetsRes, txnsRes] = await Promise.all([
    supabase.from('assets').select(ASSET_COLS).eq('household_id', m.householdId).order('sort_order', { ascending: true }),
    supabase.from('asset_transactions').select(TXN_COLS_WITH_ASSET).eq('household_id', m.householdId),
  ])
  if (assetsRes.error) console.error('getAssetsList assets:', assetsRes.error.message)
  if (txnsRes.error) console.error('getAssetsList txns:', txnsRes.error.message)
  const assets = (assetsRes.data ?? []).map(mapAsset)
  const txnRows = (txnsRes.data ?? []) as unknown as (Record<string, unknown> & { asset_id: string })[]
  const byAsset = new Map<string, AssetTxn[]>()
  for (const r of txnRows) {
    const list = byAsset.get(r.asset_id) ?? []
    list.push(mapTxn(r)); byAsset.set(r.asset_id, list)
  }
  const withKey = assets.map((a) => ({ ...a, key: assetKeyFigure(a, byAsset.get(a.id) ?? []) }))
  return TYPE_ORDER.map((type) => ({ type, assets: withKey.filter((a) => a.type === type) })).filter((g) => g.assets.length > 0)
}

export async function getAsset(id: string): Promise<{ asset: Asset; txns: AssetTxn[]; categories: AssetCategory[] } | null> {
  const m = await getMembership()
  if (!m) return null
  const supabase = await createClient()
  const { data: aRow, error: aErr } = await supabase
    .from('assets').select(ASSET_COLS).eq('household_id', m.householdId).eq('id', id).single()
  if (aErr || !aRow) { if (aErr) console.error('getAsset:', aErr.message); return null }
  const [{ data: tRows, error: tErr }, { data: cRows, error: cErr }] = await Promise.all([
    supabase.from('asset_transactions').select(TXN_COLS).eq('household_id', m.householdId).eq('asset_id', id)
      .order('date', { ascending: false }),
    supabase.from('asset_categories').select(CAT_COLS).eq('household_id', m.householdId).eq('asset_type', aRow.type)
      .order('sort_order', { ascending: true }),
  ])
  if (tErr) console.error('getAsset txns:', tErr.message)
  if (cErr) console.error('getAsset categories:', cErr.message)
  return {
    asset: mapAsset(aRow),
    txns: (tRows ?? []).map(mapTxn),
    categories: (cRows ?? []).map(mapCategory),
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors ONLY in files not yet updated (`AddTxn.tsx`, `EditTxnForm.tsx`, `PropertyBody.tsx`, `VehicleBody.tsx`, `InvestmentBody.tsx`, `actions.ts`, `page.tsx`) referencing removed fields. `assets.ts` itself compiles clean. (Those consumers are fixed in later tasks.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/assets.ts
git commit -m "feat(assets): getAsset returns categories; map category_id on transactions"
```

---

## Task 4: Category reads + CRUD actions

**Files:**
- Create: `src/lib/data/categories.ts`
- Create: `src/app/(app)/assets/categories/actions.ts`

**Interfaces:**
- Consumes: `AssetCategory`, `AssetType` (Task 2).
- Produces:
  - `getCategories(): Promise<AssetCategory[]>` (all types, ordered by type then sortOrder).
  - `createAssetCategory({ assetType, name }): Promise<{ ok: boolean; id?: string; error?: string }>`
  - `updateAssetCategory({ id, name, assetType }): Promise<{ ok: boolean; error?: string }>`
  - `deleteAssetCategory({ id }): Promise<{ ok: boolean; error?: string }>`
  - `reorderAssetCategories({ assetType, orderedIds }): Promise<{ ok: boolean; error?: string }>`

- [ ] **Step 1: Create `categories.ts`**

Create `src/lib/data/categories.ts`:

```ts
import { createClient } from '@/lib/supabase/server'
import { getMembership } from './household'
import type { AssetCategory, AssetType } from './assets-shared'

const CAT_COLS = 'id, asset_type, name, sort_order'

function mapCategory(r: { id: string; asset_type: AssetType; name: string; sort_order: number }): AssetCategory {
  return { id: r.id, assetType: r.asset_type, name: r.name, sortOrder: r.sort_order }
}

export async function getCategories(): Promise<AssetCategory[]> {
  const m = await getMembership()
  if (!m) return []
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('asset_categories').select(CAT_COLS).eq('household_id', m.householdId)
    .order('asset_type', { ascending: true }).order('sort_order', { ascending: true })
  if (error) { console.error('getCategories:', error.message); return [] }
  return ((data ?? []) as { id: string; asset_type: AssetType; name: string; sort_order: number }[]).map(mapCategory)
}
```

- [ ] **Step 2: Create the category actions**

Create `src/app/(app)/assets/categories/actions.ts`:

```ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { getMembership } from '@/lib/data/household'
import type { AssetType } from '@/lib/data/assets-shared'
import { revalidatePath } from 'next/cache'

type Res = { ok: boolean; error?: string }

function revalidate() {
  revalidatePath('/assets/categories')
  revalidatePath('/assets')
}

async function nextSortOrder(supabase: Awaited<ReturnType<typeof createClient>>, householdId: string, assetType: AssetType): Promise<number> {
  const { data } = await supabase.from('asset_categories')
    .select('sort_order').eq('household_id', householdId).eq('asset_type', assetType)
    .order('sort_order', { ascending: false }).limit(1).maybeSingle()
  return (data?.sort_order ?? 0) + 1
}

export async function createAssetCategory(input: { assetType: AssetType; name: string }): Promise<{ ok: boolean; id?: string; error?: string }> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }
  if (!input.name.trim()) return { ok: false, error: 'invalid_name' }
  const supabase = await createClient()
  const sortOrder = await nextSortOrder(supabase, m.householdId, input.assetType)
  const { data, error } = await supabase.from('asset_categories').insert({
    household_id: m.householdId, asset_type: input.assetType, name: input.name.trim(), sort_order: sortOrder,
  }).select('id').single()
  if (error || !data) { console.error('createAssetCategory:', error?.message); return { ok: false, error: 'save_failed' } }
  revalidate()
  return { ok: true, id: data.id }
}

export async function updateAssetCategory(input: { id: string; name: string; assetType: AssetType }): Promise<Res> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }
  if (!input.name.trim()) return { ok: false, error: 'invalid_name' }
  const supabase = await createClient()
  const { error } = await supabase.from('asset_categories')
    .update({ name: input.name.trim(), asset_type: input.assetType })
    .eq('id', input.id).eq('household_id', m.householdId)
  if (error) { console.error('updateAssetCategory:', error.message); return { ok: false, error: 'save_failed' } }
  revalidate()
  return { ok: true }
}

export async function deleteAssetCategory(input: { id: string }): Promise<Res> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }
  const supabase = await createClient()
  // asset_transactions.category_id is ON DELETE SET NULL — affected transactions
  // fall back into the "Other" group automatically.
  const { error } = await supabase.from('asset_categories').delete()
    .eq('id', input.id).eq('household_id', m.householdId)
  if (error) { console.error('deleteAssetCategory:', error.message); return { ok: false, error: 'save_failed' } }
  revalidate()
  return { ok: true }
}

export async function reorderAssetCategories(input: { assetType: AssetType; orderedIds: string[] }): Promise<Res> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }
  const supabase = await createClient()
  for (let i = 0; i < input.orderedIds.length; i++) {
    const { error } = await supabase.from('asset_categories').update({ sort_order: i + 1 })
      .eq('id', input.orderedIds[i]).eq('household_id', m.householdId).eq('asset_type', input.assetType)
    if (error) { console.error('reorderAssetCategories:', error.message); return { ok: false, error: 'save_failed' } }
  }
  revalidate()
  return { ok: true }
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors in `categories.ts` / `categories/actions.ts` (pre-existing errors in the not-yet-updated UI files remain).

- [ ] **Step 4: Commit**

```bash
git add src/lib/data/categories.ts "src/app/(app)/assets/categories/actions.ts"
git commit -m "feat(assets): category reads + CRUD server actions"
```

---

## Task 5: Category manager screen + "Manage" button

**Files:**
- Create: `src/app/(app)/assets/categories/page.tsx`
- Create: `src/app/(app)/assets/categories/CategoriesManager.tsx`
- Modify: `src/app/(app)/assets/page.tsx`

**Interfaces:**
- Consumes: `getCategories` (Task 4), the category actions (Task 4), `AssetCategory`/`AssetType` (Task 2), `moveItem` (`commitments-shared`), `ConfirmDialog`.

- [ ] **Step 1: Create the manager server page**

Create `src/app/(app)/assets/categories/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { getMembership } from '@/lib/data/household'
import { getCategories } from '@/lib/data/categories'
import { CategoriesManager } from './CategoriesManager'

export default async function CategoriesPage() {
  const [membership, categories] = await Promise.all([getMembership(), getCategories()])
  if (!membership) redirect('/login')
  return <CategoriesManager categories={categories} />
}
```

- [ ] **Step 2: Create the manager UI**

Create `src/app/(app)/assets/categories/CategoriesManager.tsx`:

```tsx
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronUp, ChevronDown, Trash2, Plus } from 'lucide-react'
import { useT } from '@/i18n/LocaleProvider'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { moveItem } from '@/lib/data/commitments-shared'
import type { AssetCategory, AssetType } from '@/lib/data/assets-shared'
import { createAssetCategory, updateAssetCategory, deleteAssetCategory, reorderAssetCategories } from './actions'

const ASSET_TYPES: AssetType[] = ['property', 'vehicle', 'investment', 'other']

export function CategoriesManager({ categories }: { categories: AssetCategory[] }) {
  const t = useT()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<AssetCategory | null>(null)

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true); setError(null)
    const res = await fn()
    setBusy(false)
    if (!res.ok) { setError(res.error ?? 'save_failed'); return }
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-5 pb-10">
      <header className="flex items-center gap-3">
        <Link href="/assets" aria-label={t('common.back')}
          className="pressable-opacity grid h-11 w-11 shrink-0 place-items-center text-2xl text-[var(--muted)]">‹</Link>
        <h1 className="flex-1 truncate text-xl font-extrabold text-[var(--ink-head)]">{t('assets.categories.title')}</h1>
      </header>

      {error && (
        <p role="alert" className="rounded-xl bg-[var(--pending-bg)] px-4 py-2 text-sm font-semibold text-[var(--danger)]">
          {t(`error.${error}`)}
        </p>
      )}

      <CategoryAdder disabled={busy} onAdd={(assetType, name) => run(() => createAssetCategory({ assetType, name }))} />

      {ASSET_TYPES.map((type) => {
        const rows = categories.filter((c) => c.assetType === type)
        if (rows.length === 0) return null
        return (
          <section key={type} className="flex flex-col gap-2">
            <span className="px-1 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
              {t(`assets.type.${type}`)}
            </span>
            {rows.map((c, i) => (
              <CategoryEditor
                key={c.id}
                row={c}
                disabled={busy}
                canUp={i > 0}
                canDown={i < rows.length - 1}
                onSave={(name, assetType) => run(() => updateAssetCategory({ id: c.id, name, assetType }))}
                onDelete={() => setPendingDelete(c)}
                onMove={(delta) => run(() => reorderAssetCategories({ assetType: type, orderedIds: moveItem(rows, i, delta).map((x) => x.id) }))}
              />
            ))}
          </section>
        )
      })}

      {busy && <div className="flex justify-center py-2"><Spinner /></div>}

      {pendingDelete && (
        <ConfirmDialog
          message={t('assets.categories.confirmDelete')}
          confirmLabel={t('assets.delete')}
          cancelLabel={t('common.cancel')}
          busy={busy}
          onCancel={() => setPendingDelete(null)}
          onConfirm={async () => {
            const id = pendingDelete.id
            setPendingDelete(null)
            await run(() => deleteAssetCategory({ id }))
          }}
        />
      )}
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

function TypeSelect({ value, onChange, disabled }: { value: AssetType; onChange: (t: AssetType) => void; disabled?: boolean }) {
  const t = useT()
  return (
    <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as AssetType)}
      className="shrink-0 rounded-lg border border-[var(--hairline)] bg-[var(--surface)] px-2 py-2 text-sm text-[var(--ink)] outline-none">
      {ASSET_TYPES.map((tp) => <option key={tp} value={tp}>{t(`assets.type.${tp}`)}</option>)}
    </select>
  )
}

function CategoryEditor({ row, disabled, canUp, canDown, onSave, onDelete, onMove }: {
  row: AssetCategory; disabled: boolean; canUp: boolean; canDown: boolean
  onSave: (name: string, assetType: AssetType) => void; onDelete: () => void; onMove: (delta: -1 | 1) => void
}) {
  const t = useT()
  const [name, setName] = useState(row.name)
  const [assetType, setAssetType] = useState<AssetType>(row.assetType)
  return (
    <Card className="flex items-start gap-2">
      <MoveButtons canUp={canUp} canDown={canDown} disabled={disabled} onMove={onMove} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('assets.categories.name')}
          className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--ink)] outline-none placeholder:text-[var(--faint)]" />
        <div className="flex items-center gap-2">
          <TypeSelect value={assetType} onChange={setAssetType} disabled={disabled} />
          <button type="button" disabled={disabled || !name.trim()} onClick={() => onSave(name, assetType)}
            className="pressable min-h-[40px] flex-1 rounded-lg bg-[var(--primary-btn)] px-3 text-sm font-bold text-white disabled:opacity-40">
            {t('personal.save')}
          </button>
          <button type="button" disabled={disabled} onClick={onDelete} aria-label={t('personal.delete')}
            className="pressable grid min-h-[40px] w-10 shrink-0 place-items-center rounded-lg border border-[var(--hairline)] text-[var(--danger)] disabled:opacity-40">
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </Card>
  )
}

function CategoryAdder({ disabled, onAdd }: { disabled: boolean; onAdd: (assetType: AssetType, name: string) => void }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [assetType, setAssetType] = useState<AssetType>('property')
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="pressable flex min-h-[44px] w-full items-center justify-center gap-1 rounded-xl border border-dashed border-[var(--primary)] py-3 text-sm font-bold text-[var(--primary)]">
        <Plus size={16} /> {t('assets.categories.add')}
      </button>
    )
  }
  return (
    <Card className="flex flex-col gap-2">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('assets.categories.name')}
        className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--faint)]" />
      <div className="flex items-center gap-2">
        <TypeSelect value={assetType} onChange={setAssetType} disabled={disabled} />
        <button type="button" disabled={disabled || !name.trim()}
          onClick={() => { onAdd(assetType, name.trim()); setOpen(false); setName(''); setAssetType('property') }}
          className="pressable min-h-[40px] flex-1 rounded-lg bg-[var(--primary-btn)] text-sm font-bold text-white disabled:opacity-40">
          {t('assets.categories.addConfirm')}
        </button>
        <button type="button" onClick={() => setOpen(false)} aria-label={t('common.close')}
          className="pressable-opacity grid h-10 w-10 place-items-center text-xl text-[var(--muted)]">×</button>
      </div>
    </Card>
  )
}
```

- [ ] **Step 3: Add the "Manage" button to the assets list header**

In `src/app/(app)/assets/page.tsx`, add the import at the top (after the existing imports):

```tsx
import Link from 'next/link'
```

Then replace the header block:

```tsx
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-[var(--ink-head)]">{t(locale, 'assets.title')}</h1>
      </header>
```

with:

```tsx
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-[var(--ink-head)]">{t(locale, 'assets.title')}</h1>
        <Link href="/assets/categories"
          className="pressable-opacity text-sm font-bold text-[var(--primary)]">
          {t(locale, 'assets.manageCategories')}
        </Link>
      </header>
```

- [ ] **Step 4: Verify (typecheck only — i18n keys land in Task 8)**

Run: `npx tsc --noEmit`
Expected: no type errors in the three files from this task. (Missing i18n keys are runtime fallbacks, not type errors; they are added in Task 8. Pre-existing errors in txn forms / bodies remain until their tasks.)

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/assets/categories/page.tsx" "src/app/(app)/assets/categories/CategoriesManager.tsx" "src/app/(app)/assets/page.tsx"
git commit -m "feat(assets): category manager screen + Manage entry point on list"
```

---

## Task 6: Transaction forms — actions, AddTxn, EditTxnForm

**Files:**
- Modify: `src/app/(app)/assets/actions.ts`
- Modify: `src/app/(app)/assets/[id]/AddTxn.tsx`
- Modify: `src/app/(app)/assets/[id]/txn/[txnId]/EditTxnForm.tsx`

**Interfaces:**
- Consumes: `TxnInput`/`AssetTxn`/`AssetCategory`/`AssetType` (Task 2), `createAssetCategory` (Task 4).
- Produces:
  - `addAssetTransaction({ assetId, date, description, amountCents, direction, categoryId }): Promise<{ ok; error? }>`
  - `updateAssetTransaction({ id, assetId } & TxnInput): Promise<{ ok; error? }>`
  - `toggleTransferred` removed.

- [ ] **Step 1: Update `actions.ts`**

In `src/app/(app)/assets/actions.ts`, replace the `addAssetTransaction` function (lines 7–30) with:

```ts
export async function addAssetTransaction(input: {
  assetId: string; date: string; description: string | null; amountCents: number
  direction: 'in' | 'out'; categoryId: string | null
}): Promise<{ ok: boolean; error?: string }> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) return { ok: false, error: 'invalid_amount' }
  const supabase = await createClient()
  // verify asset belongs to this household
  const { data: asset, error: lookupErr } = await supabase.from('assets').select('id').eq('household_id', m.householdId).eq('id', input.assetId).single()
  if (!asset) {
    // PGRST116 = no rows (asset missing or another household's); log anything else.
    if (lookupErr && lookupErr.code !== 'PGRST116') console.error('addAssetTransaction lookup:', lookupErr.message)
    return { ok: false, error: 'not_found' }
  }
  const { error } = await supabase.from('asset_transactions').insert({
    asset_id: input.assetId, household_id: m.householdId, date: input.date,
    description: input.description, amount_cents: input.amountCents, direction: input.direction,
    category_id: input.categoryId,
  })
  if (error) { console.error('addAssetTransaction:', error.message); return { ok: false, error: 'save_failed' } }
  revalidatePath(`/assets/${input.assetId}`); revalidatePath('/assets')
  return { ok: true }
}
```

Delete the entire `toggleTransferred` function (old lines 32–44).

Replace the body of `updateAssetTransaction` (the `.update({...})` object, old lines 54–58) so it writes the new fields:

```ts
  const { error } = await supabase.from('asset_transactions').update({
    date: input.date, description: input.description, amount_cents: input.amountCents,
    direction: input.direction, category_id: input.categoryId, notes: input.notes,
  }).eq('id', input.id).eq('household_id', m.householdId)
```

(The signature `{ id: string; assetId: string } & TxnInput` is unchanged; `TxnInput` now carries `categoryId`/`notes` instead of `txnType`/`settled`/`seq`.)

- [ ] **Step 2: Rewrite `AddTxn.tsx`**

Replace the entire contents of `src/app/(app)/assets/[id]/AddTxn.tsx` with:

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/i18n/LocaleProvider'
import { Spinner } from '@/components/ui/Spinner'
import { Fab } from '@/components/ui/Fab'
import { addAssetTransaction } from '@/app/(app)/assets/actions'
import { createAssetCategory } from '@/app/(app)/assets/categories/actions'
import { parseMoneyInput } from '@/lib/money'
import type { AssetCategory, AssetType } from '@/lib/data/assets-shared'

export function AddTxn({
  assetId,
  assetType,
  categories,
  defaultDirection = 'out',
}: {
  assetId: string
  assetType: AssetType
  categories: AssetCategory[]
  defaultDirection?: 'in' | 'out'
}) {
  const t = useT()
  const router = useRouter()
  const todayISO = new Date().toISOString().slice(0, 10)

  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(todayISO)
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [direction, setDirection] = useState<'in' | 'out'>(defaultDirection)
  const [categoryId, setCategoryId] = useState('')
  const [addingCat, setAddingCat] = useState(false)
  const [newCat, setNewCat] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(false)

  const cents = parseMoneyInput(amount)
  const canSubmit = cents > 0 && !submitting

  async function handleAddCategory() {
    const name = newCat.trim()
    if (!name) return
    const res = await createAssetCategory({ assetType, name })
    if (res.ok && res.id) {
      setCategoryId(res.id)
      setAddingCat(false)
      setNewCat('')
      router.refresh()
    } else {
      setError(true)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError(false)
    const res = await addAssetTransaction({
      assetId, date, description: description.trim() || null, amountCents: cents,
      direction, categoryId: categoryId || null,
    })
    setSubmitting(false)
    if (!res.ok) { setError(true); return }
    setDate(todayISO); setDescription(''); setAmount(''); setCategoryId(''); setDirection(defaultDirection)
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <Fab onClick={() => setOpen(true)} />
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/30" onClick={() => setOpen(false)}>
          <div
            className="mx-auto max-h-[90dvh] w-full max-w-[430px] overflow-y-auto rounded-t-2xl bg-[var(--paper)] p-5 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-[var(--ink-head)]">{t('asset.addTxn')}</span>
                <button type="button" onClick={() => setOpen(false)} aria-label={t('common.close')}
                  className="pressable-opacity grid h-11 w-11 place-items-center text-xl text-[var(--muted)]">×</button>
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-[var(--muted)]">{t('asset.form.date')}</span>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--ink)] outline-none" />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-[var(--muted)]">{t('asset.form.description')}</span>
                <input value={description} onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--ink)] outline-none placeholder:text-[var(--faint)]" />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-[var(--muted)]">{t('asset.form.amount')}</span>
                <div className="flex items-center gap-2 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3">
                  <span className="text-sm font-semibold text-[var(--muted)]">RM</span>
                  <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
                    className="flex-1 bg-transparent text-base text-[var(--ink)] outline-none placeholder:text-[var(--faint)]" />
                </div>
              </label>

              <div className="flex gap-2">
                {(['in', 'out'] as const).map((d) => {
                  const selected = direction === d
                  const color = d === 'in' ? 'var(--positive-text)' : 'var(--primary)'
                  return (
                    <button key={d} type="button" onClick={() => setDirection(d)}
                      className="pressable min-h-[44px] flex-1 rounded-xl border py-2.5 text-sm font-semibold"
                      style={{ borderColor: selected ? color : 'var(--hairline)', background: selected ? color : 'var(--surface)', color: selected ? 'white' : 'var(--ink)' }}>
                      {t(d === 'in' ? 'asset.in' : 'asset.out')}
                    </button>
                  )
                })}
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-[var(--muted)]">{t('asset.form.category')}</span>
                {!addingCat ? (
                  <div className="flex gap-2">
                    <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
                      className="flex-1 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--ink)] outline-none">
                      <option value="">{t('asset.category.other')}</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <button type="button" onClick={() => setAddingCat(true)} aria-label={t('asset.category.new')}
                      className="pressable grid min-h-[44px] w-12 shrink-0 place-items-center rounded-xl border border-[var(--hairline)] text-xl text-[var(--primary)]">＋</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder={t('asset.category.new')} autoFocus
                      className="flex-1 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--ink)] outline-none placeholder:text-[var(--faint)]" />
                    <button type="button" disabled={!newCat.trim()} onClick={handleAddCategory}
                      className="pressable min-h-[44px] shrink-0 rounded-xl bg-[var(--primary-btn)] px-3 text-sm font-bold text-white disabled:opacity-40">
                      {t('assets.categories.addConfirm')}
                    </button>
                    <button type="button" onClick={() => { setAddingCat(false); setNewCat('') }} aria-label={t('common.close')}
                      className="pressable-opacity grid h-11 w-8 shrink-0 place-items-center text-xl text-[var(--muted)]">×</button>
                  </div>
                )}
              </label>

              {error && <p role="alert" className="text-sm font-semibold text-[var(--danger)]">{t('error.save_failed')}</p>}

              <button type="submit" disabled={!canSubmit} aria-busy={submitting}
                className="pressable flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary-btn)] py-3 text-sm font-bold text-white disabled:opacity-40">
                {submitting && <Spinner />}
                {t('asset.form.save')}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 3: Rewrite `EditTxnForm.tsx`**

Replace the entire contents of `src/app/(app)/assets/[id]/txn/[txnId]/EditTxnForm.tsx` with:

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useT } from '@/i18n/LocaleProvider'
import { Spinner } from '@/components/ui/Spinner'
import { ConfirmButton } from '@/components/ui/ConfirmButton'
import { parseMoneyInput } from '@/lib/money'
import type { AssetTxn, AssetType, AssetCategory } from '@/lib/data/assets-shared'
import { updateAssetTransaction, deleteAssetTransaction } from '@/app/(app)/assets/actions'
import { createAssetCategory } from '@/app/(app)/assets/categories/actions'

export function EditTxnForm({
  assetId,
  txn,
  assetType,
  categories,
}: {
  assetId: string
  txn: AssetTxn
  assetType: AssetType
  categories: AssetCategory[]
}) {
  const t = useT()
  const router = useRouter()

  const [date, setDate] = useState(txn.date)
  const [description, setDescription] = useState(txn.description ?? '')
  const [amount, setAmount] = useState((txn.amountCents / 100).toFixed(2))
  const [direction, setDirection] = useState<'in' | 'out'>(txn.direction)
  const [categoryId, setCategoryId] = useState(txn.categoryId ?? '')
  const [notes, setNotes] = useState(txn.notes ?? '')
  const [addingCat, setAddingCat] = useState(false)
  const [newCat, setNewCat] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cents = parseMoneyInput(amount)
  const canSave = cents > 0 && !busy

  async function handleAddCategory() {
    const name = newCat.trim()
    if (!name) return
    const res = await createAssetCategory({ assetType, name })
    if (res.ok && res.id) {
      setCategoryId(res.id); setAddingCat(false); setNewCat(''); router.refresh()
    } else {
      setError('save_failed')
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!canSave) return
    setBusy(true); setError(null)
    const res = await updateAssetTransaction({
      id: txn.id, assetId, date, description: description.trim() || null, amountCents: cents,
      direction, categoryId: categoryId || null, notes: notes.trim() || null,
    })
    setBusy(false)
    if (!res.ok) { setError(res.error ?? 'save_failed'); return }
    router.push(`/assets/${assetId}`)
  }

  async function remove() {
    setBusy(true); setError(null)
    const res = await deleteAssetTransaction({ id: txn.id, assetId })
    setBusy(false)
    if (!res.ok) { setError('delete_failed'); return }
    router.push(`/assets/${assetId}`)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[var(--paper)]">
      <div className="mx-auto flex min-h-full max-w-[430px] flex-col px-[18px] pb-6 pt-4">
        <div className="flex items-center justify-between py-2">
          <Link href={`/assets/${assetId}`} aria-label={t('common.back')}
            className="pressable-opacity grid h-11 w-11 place-items-center text-2xl text-[var(--muted)]">‹</Link>
          <h1 className="text-base font-bold text-[var(--ink-head)]">{t('asset.editTxn')}</h1>
          <div className="h-11 w-11" />
        </div>

        <form onSubmit={save} className="flex flex-1 flex-col gap-3 pt-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-[var(--muted)]">{t('asset.form.date')}</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--ink)] outline-none" />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-[var(--muted)]">{t('asset.form.description')}</span>
            <input value={description} onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--ink)] outline-none placeholder:text-[var(--faint)]" />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-[var(--muted)]">{t('asset.form.amount')}</span>
            <div className="flex items-center gap-2 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3">
              <span className="text-sm font-semibold text-[var(--muted)]">RM</span>
              <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
                className="flex-1 bg-transparent text-base text-[var(--ink)] outline-none placeholder:text-[var(--faint)]" />
            </div>
          </label>

          <div className="flex gap-2">
            {(['in', 'out'] as const).map((d) => {
              const selected = direction === d
              const color = d === 'in' ? 'var(--positive-text)' : 'var(--primary)'
              return (
                <button key={d} type="button" onClick={() => setDirection(d)}
                  className="pressable min-h-[44px] flex-1 rounded-xl border py-2.5 text-sm font-semibold"
                  style={{ borderColor: selected ? color : 'var(--hairline)', background: selected ? color : 'var(--surface)', color: selected ? 'white' : 'var(--ink)' }}>
                  {t(d === 'in' ? 'asset.in' : 'asset.out')}
                </button>
              )
            })}
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-[var(--muted)]">{t('asset.form.category')}</span>
            {!addingCat ? (
              <div className="flex gap-2">
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
                  className="flex-1 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--ink)] outline-none">
                  <option value="">{t('asset.category.other')}</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button type="button" onClick={() => setAddingCat(true)} aria-label={t('asset.category.new')}
                  className="pressable grid min-h-[44px] w-12 shrink-0 place-items-center rounded-xl border border-[var(--hairline)] text-xl text-[var(--primary)]">＋</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder={t('asset.category.new')} autoFocus
                  className="flex-1 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--ink)] outline-none placeholder:text-[var(--faint)]" />
                <button type="button" disabled={!newCat.trim()} onClick={handleAddCategory}
                  className="pressable min-h-[44px] shrink-0 rounded-xl bg-[var(--primary-btn)] px-3 text-sm font-bold text-white disabled:opacity-40">
                  {t('assets.categories.addConfirm')}
                </button>
                <button type="button" onClick={() => { setAddingCat(false); setNewCat('') }} aria-label={t('common.close')}
                  className="pressable-opacity grid h-11 w-8 shrink-0 place-items-center text-xl text-[var(--muted)]">×</button>
              </div>
            )}
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-[var(--muted)]">{t('asset.form.note')}</span>
            <input value={notes} onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--ink)] outline-none placeholder:text-[var(--faint)]" />
          </label>

          {error && <p role="alert" className="text-sm font-semibold text-[var(--danger)]">{t(`error.${error}`)}</p>}

          <div className="flex-1" />

          <button type="submit" disabled={!canSave} aria-busy={busy}
            className="pressable flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary-btn)] py-3 text-sm font-bold text-white disabled:opacity-40">
            {busy && <Spinner />}
            {t('asset.form.saveChanges')}
          </button>
          <ConfirmButton onConfirm={remove} label={t('asset.deleteTxn')} confirmLabel={t('common.sure')} disabled={busy}
            className="pressable min-h-[44px] w-full rounded-xl border border-[var(--hairline)] py-3 text-sm font-bold text-[var(--danger)] disabled:opacity-40" />
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Update the edit-txn page to pass categories**

In `src/app/(app)/assets/[id]/txn/[txnId]/page.tsx`, replace the final return:

```tsx
  return <EditTxnForm assetId={id} txn={txn} assetType={result.asset.type} />
```

with:

```tsx
  return <EditTxnForm assetId={id} txn={txn} assetType={result.asset.type} categories={result.categories} />
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: remaining errors ONLY in `page.tsx` (detail) and the three `*Body.tsx` files (still referencing old props/fields) — fixed in Task 7.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/assets/actions.ts" "src/app/(app)/assets/[id]/AddTxn.tsx" "src/app/(app)/assets/[id]/txn/[txnId]/EditTxnForm.tsx" "src/app/(app)/assets/[id]/txn/[txnId]/page.tsx"
git commit -m "feat(assets): category picker in add/edit txn; drop settled/txn_type from actions"
```

---

## Task 7: Unified `AssetBody` + detail page; delete old bodies

**Files:**
- Create: `src/app/(app)/assets/[id]/AssetBody.tsx`
- Modify: `src/app/(app)/assets/[id]/page.tsx`
- Delete: `PropertyBody.tsx`, `VehicleBody.tsx`, `InvestmentBody.tsx`

**Interfaces:**
- Consumes: `Asset`/`AssetTxn`/`AssetCategory`/`CategoryGroup`, `runningBalanceCents`, `groupByCategory` (Task 2); `Commitment` (`commitments-shared`); `getAsset`, `getCommitments`.

- [ ] **Step 1: Create `AssetBody.tsx`**

Create `src/app/(app)/assets/[id]/AssetBody.tsx`:

```tsx
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ArrowDown, ArrowUp, Pencil, ChevronDown, ChevronRight, ChevronUp, SlidersHorizontal } from 'lucide-react'
import { useT } from '@/i18n/LocaleProvider'
import { HeroCard, Card } from '@/components/ui/Card'
import { MoneyText } from '@/components/ui/MoneyText'
import { runningBalanceCents, groupByCategory } from '@/lib/data/assets-shared'
import type { Asset, AssetTxn, AssetCategory, CategoryGroup } from '@/lib/data/assets-shared'
import type { Commitment } from '@/lib/data/commitments-shared'

export function AssetBody({ asset, txns, categories, commitments }: {
  asset: Asset; txns: AssetTxn[]; categories: AssetCategory[]; commitments: Commitment[]
}) {
  const t = useT()
  const balance = runningBalanceCents(asset.openingBalanceCents, txns)
  const hasOpening = (asset.openingBalanceCents ?? 0) !== 0
  const groups = groupByCategory(txns, categories, t('asset.category.other'))

  return (
    <div className="flex flex-col gap-4">
      <HeroCard>
        <span className="text-sm font-bold opacity-90">{t('asset.balance')}</span>
        <div className="mt-1"><MoneyText cents={balance} className="text-[32px] font-extrabold" /></div>
      </HeroCard>

      <CommitmentsSection assetId={asset.id} commitments={commitments} />

      {groups.length === 0 && !hasOpening ? (
        <p className="py-10 text-center text-sm font-semibold text-[var(--faint)]">{t('asset.empty')}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((g) => <TxnGroup key={g.categoryId ?? '__other'} assetId={asset.id} group={g} />)}
          {hasOpening && (
            <Card className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-[var(--muted)]">{t('asset.openingBalance')}</span>
              <MoneyText cents={asset.openingBalanceCents ?? 0} className="text-sm font-bold text-[var(--muted)]" />
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

function TxnGroup({ assetId, group }: { assetId: string; group: CategoryGroup }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="pressable-opacity flex items-center gap-2 px-1">
        {open ? <ChevronDown size={16} className="text-[var(--muted)]" /> : <ChevronRight size={16} className="text-[var(--muted)]" />}
        <span className="flex-1 text-left text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{group.name}</span>
        <MoneyText cents={group.subtotalCents} className="text-xs font-bold text-[var(--faint)]" />
      </button>
      {open && (
        <Card className="flex flex-col gap-3">
          {group.rows.map((txn) => <TxnRow key={txn.id} assetId={assetId} txn={txn} />)}
        </Card>
      )}
    </div>
  )
}

function TxnRow({ assetId, txn }: { assetId: string; txn: AssetTxn }) {
  const t = useT()
  const isIn = txn.direction === 'in'
  const arrowColor = isIn ? 'var(--positive-text)' : 'var(--primary)'
  return (
    <div className="flex items-start gap-3 border-t border-[var(--hairline)] pt-3 first:border-t-0 first:pt-0">
      {isIn
        ? <ArrowDown size={18} strokeWidth={2.5} className="mt-0.5 shrink-0" style={{ color: arrowColor }} />
        : <ArrowUp size={18} strokeWidth={2.5} className="mt-0.5 shrink-0" style={{ color: arrowColor }} />}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[var(--ink)]">{txn.description ?? '—'}</p>
        <p className="text-xs text-[var(--muted)]">{txn.date} · {t(isIn ? 'asset.in' : 'asset.out')}</p>
        {txn.notes && <p className="mt-0.5 text-xs italic text-[var(--faint)]">{txn.notes}</p>}
      </div>
      <span className="shrink-0 text-sm font-bold tabular-nums" style={{ color: isIn ? arrowColor : 'var(--ink-head)' }}>
        {isIn ? '+' : '−'} <MoneyText cents={txn.amountCents} />
      </span>
      <Link href={`/assets/${assetId}/txn/${txn.id}`} aria-label={t('asset.editTxn')}
        className="pressable-opacity grid h-8 w-8 shrink-0 place-items-center text-[var(--muted)]">
        <Pencil size={15} />
      </Link>
    </div>
  )
}

function CommitmentsSection({ assetId, commitments }: { assetId: string; commitments: Commitment[] }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const total = commitments.reduce((a, c) => a + c.amountCents, 0)
  return (
    <Card className="flex flex-col">
      <div className="-my-1 flex items-center justify-between gap-2">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
          className="pressable-opacity flex min-w-0 flex-1 items-center text-left">
          <span className="truncate text-sm font-bold text-[var(--ink-head)]">{t('asset.commitments.title')}</span>
        </button>
        <div className="flex shrink-0 items-center gap-0.5">
          <Link href={`/assets/${assetId}/commitments`} aria-label={t('common.manage')}
            className="pressable-opacity grid h-8 w-8 place-items-center text-[var(--muted)]">
            <SlidersHorizontal size={18} />
          </Link>
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={t('asset.commitments.title')}
            className="pressable-opacity grid h-8 w-8 place-items-center text-[var(--muted)]">
            {open ? <ChevronUp size={18} strokeWidth={2.5} /> : <ChevronDown size={18} strokeWidth={2.5} />}
          </button>
        </div>
      </div>

      {open && (commitments.length === 0 ? (
        <p className="mt-3 border-t border-[var(--hairline)] pt-3 text-center text-sm font-semibold text-[var(--faint)]">
          {t('asset.commitments.empty')}
        </p>
      ) : (
        <div className="mt-2 flex flex-col">
          {commitments.map((c, i) => (
            <div key={i} className="flex items-center justify-between gap-2 border-t border-[var(--hairline)] py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[var(--ink-head)]">{c.name}</p>
                {c.remark && <p className="truncate text-xs text-[var(--muted)]">{c.remark}</p>}
              </div>
              <MoneyText cents={c.amountCents} className="shrink-0 text-sm font-bold text-[var(--ink-head)]" />
            </div>
          ))}
          <div className="flex items-center justify-between gap-2 border-t border-[var(--hairline)] pt-2.5">
            <span className="text-sm font-bold text-[var(--ink-head)]">{t('asset.commitments.total')}</span>
            <MoneyText cents={total} className="text-sm font-extrabold text-[var(--ink-head)]" />
          </div>
        </div>
      ))}
    </Card>
  )
}
```

- [ ] **Step 2: Rewrite the detail page**

Replace the entire contents of `src/app/(app)/assets/[id]/page.tsx` with:

```tsx
import Link from 'next/link'
import { Download } from 'lucide-react'
import { notFound } from 'next/navigation'
import { getAsset } from '@/lib/data/assets'
import { getCommitments } from '@/lib/data/commitments'
import type { Commitment } from '@/lib/data/commitments-shared'
import { getMembership } from '@/lib/data/household'
import { t, type Locale } from '@/i18n'
import { AssetBody } from './AssetBody'
import { AddTxn } from './AddTxn'

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [result, membership] = await Promise.all([getAsset(id), getMembership()])
  if (!result) notFound()
  const { asset, txns, categories } = result
  const commitments: Commitment[] = await getCommitments(asset.id)
  const locale: Locale = membership?.language ?? 'en'

  const defaultDirection: 'in' | 'out' = asset.type === 'property' ? 'in' : 'out'

  return (
    <div className="flex flex-col gap-5 pb-28">
      <header className="flex items-center gap-3">
        <Link href="/assets" aria-label={t(locale, 'common.back')}
          className="pressable-opacity grid h-11 w-11 shrink-0 place-items-center text-2xl text-[var(--muted)]">‹</Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-extrabold text-[var(--ink-head)]">{asset.name}</h1>
          <p className="truncate text-xs font-semibold text-[var(--muted)]">
            {t(locale, `assets.type.${asset.type}`)}
            {asset.status === 'closed' ? ` · ${t(locale, 'assets.closed')}` : ''}
          </p>
        </div>
        <a href={`/report/export?type=asset&id=${asset.id}`} download
          className="pressable-opacity flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-3 text-sm font-bold text-[var(--ink)]">
          <Download size={16} className="text-[var(--muted)]" />
          {t(locale, 'asset.exportCsv')}
        </a>
      </header>

      <AssetBody asset={asset} txns={txns} categories={categories} commitments={commitments} />

      <AddTxn assetId={asset.id} assetType={asset.type} categories={categories} defaultDirection={defaultDirection} />
    </div>
  )
}
```

- [ ] **Step 3: Delete the old body components**

```bash
git rm "src/app/(app)/assets/[id]/PropertyBody.tsx" "src/app/(app)/assets/[id]/VehicleBody.tsx" "src/app/(app)/assets/[id]/InvestmentBody.tsx"
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS with zero errors across the whole project. (If any error mentions `StatusChip`/`ProgressBar` now being unused, that is not a type error; leave those components in place — they may be used elsewhere.)

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/assets/[id]/AssetBody.tsx" "src/app/(app)/assets/[id]/page.tsx"
git commit -m "feat(assets): unified AssetBody for all types; commitments on all types; remove per-type bodies"
```

---

## Task 8: i18n keys (add new, remove dead)

**Files:**
- Modify: `src/i18n/dictionaries.ts`

**Interfaces:**
- Produces the keys referenced by Tasks 5–7 in both `en` and `zh`.

- [ ] **Step 1: Add the new keys**

In `src/i18n/dictionaries.ts`, inside the `en` dictionary, next to the other `asset.*` / `assets.*` keys, add:

```ts
    'assets.manageCategories': 'Manage',
    'assets.categories.title': 'Transaction categories',
    'assets.categories.name': 'Category name',
    'assets.categories.add': 'Add category',
    'assets.categories.addConfirm': 'Add',
    'assets.categories.confirmDelete': 'Delete this category? Its transactions will move to "Other".',
    'asset.category.other': 'Other',
    'asset.category.new': 'New category',
    'asset.form.category': 'Category',
    'asset.form.note': 'Note (optional)',
```

In the `zh` dictionary add the same keys:

```ts
    'assets.manageCategories': '管理',
    'assets.categories.title': '交易类别',
    'assets.categories.name': '类别名称',
    'assets.categories.add': '添加类别',
    'assets.categories.addConfirm': '添加',
    'assets.categories.confirmDelete': '删除此类别？其交易将移至「其他」。',
    'asset.category.other': '其他',
    'asset.category.new': '新类别',
    'asset.form.category': '类别',
    'asset.form.note': '备注（可选）',
```

- [ ] **Step 2: Remove dead keys**

In BOTH the `en` and `zh` dictionaries, delete these now-unused keys:

```
'asset.transferred', 'asset.nextPayment', 'asset.totalPaid', 'asset.of',
'asset.paidUp', 'asset.txnType.loan', 'asset.txnType.road_tax_insurance',
'asset.txnType.maintenance', 'asset.txnType.loan_payback', 'asset.txnType.other',
'asset.form.txnType'
```

Leave `assets.key.next_payment` and `assets.key.paid` in place only if `KeyFigure.label` could still produce them — it cannot after Task 2 (label is always `'balance'`), so also delete `'assets.key.next_payment'` and `'assets.key.paid'` from both dictionaries. Keep `'assets.key.balance'`.

- [ ] **Step 3: Verify the i18n parity test passes**

Run: `npx vitest run src/i18n/dictionaries.test.ts`
Expected: PASS. The `locale parity` test asserts every `en` key (except `test.*`) has a `zh` translation — so each new key MUST be added to both dictionaries. The test does not check the reverse direction, so when removing dead keys, remove them from BOTH `en` and `zh` (removing from `en` only would silently orphan the `zh` entry). If the test fails, add the missing `zh` translations listed in its output.

- [ ] **Step 4: Full verification**

Run: `npm test && npm run lint && npx tsc --noEmit && npm run build`
Expected: all pass, build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/i18n/dictionaries.ts
git commit -m "i18n(assets): add category keys; remove settled/next-payment/txn-type keys"
```

---

## Task 9: Manual verification pass

**Files:** none (exercise the running app).

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` and open `http://localhost:3000/assets`.

- [ ] **Step 2: Walk the flows and confirm each**

- [ ] Assets list shows a **Manage** button top-right; every row's figure label reads **Balance**.
- [ ] Open a **vehicle**: Balance hero, Commitments card present, transactions in **collapsible** category groups (backfilled from old `txn_type`), each group shows a subtotal; collapse/expand works per group.
- [ ] Open a **property**: same structure; opening-balance line appears at list end when it has an opening balance; Commitments card present.
- [ ] **Add transaction**: category `<select>` lists that type's categories + "Other"; **＋** creates a new category inline and selects it; saved txn appears under the chosen group.
- [ ] **Edit transaction**: category preselected; changing it re-groups the row; the **Note** field saves and renders as an italic line under the row.
- [ ] **Manage → categories**: add (with type dropdown), rename, reorder within a type, and **delete** → confirm dialog states transactions move to "Other" → after delete the affected transactions appear under **Other** on the asset detail.
- [ ] Toggle app language to 中文 and confirm all new labels are translated.

- [ ] **Step 3: Note any defects** and fix in a follow-up commit before considering the plan complete.

---

## Self-review notes (addressed)

- **Spec coverage:** Balance hero (T2/T7), removed features (T2/T6/T7), note line (T6/T7), collapsible groups (T7), "Other" default (T2/T7), commitments on all types (T7), category table + RLS + backfill (T1), per-type scope + type dropdown (T4/T5/T6), delete→confirm→Other (T4/T5), Manage entry point (T5), add/edit picker + inline create (T6), i18n + cleanup (T8). All covered.
- **Type consistency:** `AssetTxn` (categoryId/notes, no txnType/settled/seq), `AssetCategory` (id/assetType/name/sortOrder), `CategoryGroup`, `TxnInput`, and the action signatures are defined once in Task 2 and consumed unchanged in Tasks 3–7.
- **Out of scope (per spec):** the CSV export route (`/report/export`) is left untouched; if it still reads `txn_type`, that is acceptable for now. The Commitments card redesign is deferred. Dropping the now-unused `settled`/`seq`/`txn_type` columns is deferred to a later migration.
