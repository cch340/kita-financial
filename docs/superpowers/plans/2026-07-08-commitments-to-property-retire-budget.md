# Move Monthly Commitments to the TreeO Property & Retire Budget — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Relocate the monthly-commitments breakdown from the budget module onto the property asset it belongs to (TreeO), then retire the now-empty budget module.

**Architecture:** `monthly_commitments` gains an `asset_id` FK (household_id retained for unchanged RLS) and a single free-text `name` (replacing bilingual `name_en`/`name_zh`); its existing `remark` column gets surfaced. Commitments render as an informational card on the property detail page with a dedicated manage screen. The budget route, nav tab, `budget_categories` table, and the home budget card are removed.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind 4, Supabase (Postgres + RLS), vitest + jsdom.

## Global Constraints

- **Money is integer cents** everywhere; format only at the edge with `formatRM` / `MoneyText`. Parse user input with `parseMoneyInput`.
- **Data-layer split:** pure/framework-free logic in `*-shared.ts` (no `next/headers`, no Supabase); server reads in `<domain>.ts`; mutations in `'use server'` `actions.ts` colocated with the screen.
- **Household scoping:** every query filters by `householdId` from `getMembership()`; always use the anon `createClient` so RLS applies.
- **Server actions** parse input, call the data layer, then `revalidatePath(...)` affected screens.
- **Migrations** are applied manually in the Supabase SQL editor (no local DB tooling). New migration files are numbered sequentially in `supabase/migrations/`.
- **i18n:** every user-facing string goes through `t(locale, key)` with an EN + ZH entry in `src/i18n/dictionaries.ts`.
- Household id (seed): `00000000-0000-0000-0000-0000000000aa`. TreeO asset id (seed): `00000000-0000-0000-0000-0000000000b1`.

---

### Task 1: Migration — attach commitments to asset, consolidate name, drop budget_categories

**Files:**
- Create: `supabase/migrations/0007_commitments_to_asset.sql`

**Interfaces:**
- Produces: `monthly_commitments` columns become `(id, household_id, asset_id NOT NULL, name NOT NULL, amount_cents, remark, sort_order)`; `budget_categories` table no longer exists.

- [ ] **Step 1: Write the migration file**

```sql
-- 0007_commitments_to_asset.sql
-- Move monthly commitments onto the property they belong to, consolidate the
-- bilingual name into a single free-text name, and retire budget categories.

-- 1. Attach each commitment to an asset (household_id kept for RLS/home query).
alter table monthly_commitments
  add column asset_id uuid references assets(id) on delete cascade;

update monthly_commitments mc set asset_id = (
  select a.id from assets a
  where a.household_id = mc.household_id and a.type = 'property'
  order by a.sort_order limit 1
) where asset_id is null;

alter table monthly_commitments alter column asset_id set not null;

-- 2. Consolidate name_en/name_zh -> single free-text name.
alter table monthly_commitments add column name text;
update monthly_commitments
  set name = coalesce(nullif(btrim(name_en), ''), name_zh, '');
alter table monthly_commitments alter column name set not null;
alter table monthly_commitments drop column name_en;
alter table monthly_commitments drop column name_zh;

-- 3. Retire budget categories (superseded by recurring funds). Drops its RLS policy too.
drop table if exists budget_categories cascade;
```

- [ ] **Step 2: Sanity-check the SQL**

Run: `grep -c "alter table monthly_commitments" supabase/migrations/0007_commitments_to_asset.sql`
Expected: `5`

The RLS policy `mc_all` on `monthly_commitments` is unchanged (still `is_member(household_id)`), because `household_id` is retained. No new policy needed.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0007_commitments_to_asset.sql
git commit -m "feat(db): attach monthly_commitments to asset, single name, drop budget_categories"
```

> **Apply manually** in the Supabase SQL editor (per SETUP.md) before running the app against a real DB. Backfill assumes each household with commitments has exactly one property asset (true for this household).

---

### Task 2: Migration — clean TreeO transaction descriptions

**Files:**
- Create: `supabase/migrations/0008_treeo_txn_cleanup.sql`

**Interfaces:**
- Produces: property `asset_transactions` descriptions have no `💵`/`⚡`/`💧`; the recurring "Monthly Commitment" inflow reads "Installment + Maintenance".

- [ ] **Step 1: Write the migration file**

```sql
-- 0008_treeo_txn_cleanup.sql
-- Rename the recurring commitment inflow and strip emoji from property txns.

update asset_transactions
  set description = 'Installment + Maintenance'
  where txn_type = 'monthly_commitment'
    and description like 'Monthly Commitment%';

update asset_transactions
  set description = btrim(
    replace(replace(replace(description, '💵', ''), '⚡', ''), '💧', '')
  )
  where description ~ '[💵⚡💧]';
```

- [ ] **Step 2: Sanity-check the SQL**

Run: `grep -c "update asset_transactions" supabase/migrations/0008_treeo_txn_cleanup.sql`
Expected: `2`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0008_treeo_txn_cleanup.sql
git commit -m "feat(db): rename commitment inflow + strip emoji from property txns"
```

> **Apply manually** in the Supabase SQL editor.

---

### Task 3: Pure shared module — `commitments-shared.ts`

**Files:**
- Create: `src/lib/data/commitments-shared.ts`
- Test: `src/lib/data/commitments-shared.test.ts`

**Interfaces:**
- Produces:
  - `type Commitment = { name: string; amountCents: number; remark: string | null }`
  - `type CommitmentRow = Commitment & { id: string; sortOrder: number }`
  - `function moveItem<T>(items: T[], index: number, delta: -1 | 1): T[]`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/data/commitments-shared.test.ts
import { describe, it, expect } from 'vitest'
import { moveItem } from './commitments-shared'

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

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/data/commitments-shared.test.ts`
Expected: FAIL — cannot resolve `./commitments-shared`.

- [ ] **Step 3: Write the module**

```ts
// src/lib/data/commitments-shared.ts
// Pure, server/client-safe commitment helpers and types — no supabase import here.
export type Commitment = {
  name: string
  amountCents: number
  remark: string | null
}
export type CommitmentRow = Commitment & {
  id: string
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

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/data/commitments-shared.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/commitments-shared.ts src/lib/data/commitments-shared.test.ts
git commit -m "feat(data): pure commitments-shared module (moveItem + types)"
```

---

### Task 4: Server reads — `commitments.ts`

**Files:**
- Create: `src/lib/data/commitments.ts`

**Interfaces:**
- Consumes: `Commitment`, `CommitmentRow` from `./commitments-shared`.
- Produces:
  - `getCommitments(assetId: string): Promise<Commitment[]>` — display list, ordered by `sort_order`.
  - `getCommitmentsRaw(assetId: string): Promise<CommitmentRow[]>` — manage list.
  - Re-exports `moveItem`, `Commitment`, `CommitmentRow`.

- [ ] **Step 1: Write the module**

```ts
// src/lib/data/commitments.ts
import { createClient } from '@/lib/supabase/server'
import { getMembership } from './household'
import type { Commitment, CommitmentRow } from './commitments-shared'

export { moveItem } from './commitments-shared'
export type { Commitment, CommitmentRow } from './commitments-shared'

export async function getCommitments(assetId: string): Promise<Commitment[]> {
  const m = await getMembership()
  if (!m) return []
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('monthly_commitments')
    .select('name, amount_cents, remark, sort_order')
    .eq('household_id', m.householdId)
    .eq('asset_id', assetId)
    .order('sort_order', { ascending: true })
  if (error) { console.error('getCommitments:', error.message); return [] }
  return ((data ?? []) as { name: string; amount_cents: number; remark: string | null }[])
    .map((c) => ({ name: c.name, amountCents: c.amount_cents, remark: c.remark }))
}

export async function getCommitmentsRaw(assetId: string): Promise<CommitmentRow[]> {
  const m = await getMembership()
  if (!m) return []
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('monthly_commitments')
    .select('id, name, amount_cents, remark, sort_order')
    .eq('household_id', m.householdId)
    .eq('asset_id', assetId)
    .order('sort_order', { ascending: true })
  if (error) { console.error('getCommitmentsRaw:', error.message); return [] }
  return ((data ?? []) as { id: string; name: string; amount_cents: number; remark: string | null; sort_order: number }[])
    .map((c) => ({ id: c.id, name: c.name, amountCents: c.amount_cents, remark: c.remark, sortOrder: c.sort_order }))
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors from `commitments.ts` (pre-existing budget errors are fine — cleaned up in Task 9).

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/commitments.ts
git commit -m "feat(data): server reads for asset-scoped commitments"
```

---

### Task 5: Server actions — `assets/[id]/commitments/actions.ts`

**Files:**
- Create: `src/app/(app)/assets/[id]/commitments/actions.ts`

**Interfaces:**
- Consumes: `createClient`, `getMembership`.
- Produces (all return `{ ok: boolean; error?: string }`):
  - `createCommitment({ assetId, name, amountCents, remark })`
  - `updateCommitment({ id, assetId, name, amountCents, remark })`
  - `deleteCommitment({ id, assetId })`
  - `reorderCommitments({ assetId, orderedIds })`

- [ ] **Step 1: Write the actions file**

```ts
// src/app/(app)/assets/[id]/commitments/actions.ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { getMembership } from '@/lib/data/household'
import { revalidatePath } from 'next/cache'

type Res = { ok: boolean; error?: string }

function revalidate(assetId: string) {
  revalidatePath(`/assets/${assetId}`)
  revalidatePath(`/assets/${assetId}/commitments`)
  revalidatePath('/')
}

export async function createCommitment(input: {
  assetId: string; name: string; amountCents: number; remark: string | null
}): Promise<Res> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }
  if (!input.name.trim()) return { ok: false, error: 'invalid_name' }
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) return { ok: false, error: 'invalid_amount' }
  const supabase = await createClient()
  const { data: maxRow } = await supabase.from('monthly_commitments')
    .select('sort_order').eq('household_id', m.householdId).eq('asset_id', input.assetId)
    .order('sort_order', { ascending: false }).limit(1).maybeSingle()
  const nextOrder = (maxRow?.sort_order ?? 0) + 1
  const { error } = await supabase.from('monthly_commitments').insert({
    household_id: m.householdId, asset_id: input.assetId, name: input.name.trim(),
    amount_cents: input.amountCents, remark: input.remark?.trim() || null, sort_order: nextOrder,
  })
  if (error) { console.error('createCommitment:', error.message); return { ok: false, error: 'save_failed' } }
  revalidate(input.assetId)
  return { ok: true }
}

export async function updateCommitment(input: {
  id: string; assetId: string; name: string; amountCents: number; remark: string | null
}): Promise<Res> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }
  if (!input.name.trim()) return { ok: false, error: 'invalid_name' }
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) return { ok: false, error: 'invalid_amount' }
  const supabase = await createClient()
  const { error } = await supabase.from('monthly_commitments').update({
    name: input.name.trim(), amount_cents: input.amountCents, remark: input.remark?.trim() || null,
  }).eq('id', input.id).eq('household_id', m.householdId)
  if (error) { console.error('updateCommitment:', error.message); return { ok: false, error: 'save_failed' } }
  revalidate(input.assetId)
  return { ok: true }
}

export async function deleteCommitment(input: { id: string; assetId: string }): Promise<Res> {
  const m = await getMembership()
  if (!m) return { ok: false }
  const supabase = await createClient()
  const { error } = await supabase.from('monthly_commitments').delete()
    .eq('id', input.id).eq('household_id', m.householdId)
  if (error) { console.error('deleteCommitment:', error.message); return { ok: false, error: 'save_failed' } }
  revalidate(input.assetId)
  return { ok: true }
}

export async function reorderCommitments(input: { assetId: string; orderedIds: string[] }): Promise<Res> {
  const m = await getMembership()
  if (!m) return { ok: false }
  const supabase = await createClient()
  for (let i = 0; i < input.orderedIds.length; i++) {
    const { error } = await supabase.from('monthly_commitments')
      .update({ sort_order: i + 1 }).eq('id', input.orderedIds[i]).eq('household_id', m.householdId)
    if (error) { console.error('reorderCommitments:', error.message); return { ok: false, error: 'save_failed' } }
  }
  revalidate(input.assetId)
  return { ok: true }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors from the actions file.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/assets/[id]/commitments/actions.ts"
git commit -m "feat(assets): server actions for asset commitments CRUD + reorder"
```

---

### Task 6: i18n — add `asset.commitments.*` keys

**Files:**
- Modify: `src/i18n/dictionaries.ts` (EN block near the other `asset.*` keys; ZH block similarly)

**Interfaces:**
- Produces keys: `asset.commitments.title`, `.total`, `.manage`, `.empty`, `.add`, `.addConfirm`, `.name`, `.remarkOptional`.

- [ ] **Step 1: Add the EN keys**

Add to the English dictionary object (near the existing `asset.*` entries):

```ts
    'asset.commitments.title': 'Monthly commitments',
    'asset.commitments.total': 'Total',
    'asset.commitments.manage': 'Manage',
    'asset.commitments.empty': 'No commitments yet',
    'asset.commitments.add': 'Add commitment',
    'asset.commitments.addConfirm': 'Add',
    'asset.commitments.name': 'Name',
    'asset.commitments.remarkOptional': 'Remark (optional)',
```

- [ ] **Step 2: Add the ZH keys**

Add to the Chinese dictionary object:

```ts
    'asset.commitments.title': '每月固定支出',
    'asset.commitments.total': '合计',
    'asset.commitments.manage': '管理',
    'asset.commitments.empty': '暂无固定支出',
    'asset.commitments.add': '添加固定支出',
    'asset.commitments.addConfirm': '添加',
    'asset.commitments.name': '名称',
    'asset.commitments.remarkOptional': '备注（选填）',
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (dictionary keys stay in sync EN/ZH).

- [ ] **Step 4: Commit**

```bash
git add src/i18n/dictionaries.ts
git commit -m "i18n: add asset.commitments.* keys (EN + ZH)"
```

---

### Task 7: Property detail — render the commitments card

**Files:**
- Modify: `src/app/(app)/assets/[id]/page.tsx` (fetch commitments for property; pass to `PropertyBody`)
- Modify: `src/app/(app)/assets/[id]/PropertyBody.tsx` (accept `commitments` prop; render a section under the hero)

**Interfaces:**
- Consumes: `getCommitments(assetId)` → `Commitment[]`; `Commitment` type.
- Produces: `PropertyBody` now takes `commitments: Commitment[]`.

- [ ] **Step 1: Fetch commitments in the detail page**

In `src/app/(app)/assets/[id]/page.tsx`, add the import and fetch. Change the import line near the top:

```ts
import { getAsset } from '@/lib/data/assets'
import { getCommitments } from '@/lib/data/commitments'
import type { Commitment } from '@/lib/data/commitments-shared'
```

Replace the data fetch + `PropertyBody` render. The current fetch is:

```ts
  const [result, membership] = await Promise.all([getAsset(id), getMembership()])
  if (!result) notFound()
  const { asset, txns } = result
```

Change to:

```ts
  const [result, membership] = await Promise.all([getAsset(id), getMembership()])
  if (!result) notFound()
  const { asset, txns } = result
  const commitments: Commitment[] = asset.type === 'property' ? await getCommitments(asset.id) : []
```

And change the property render line:

```ts
      {asset.type === 'property' && <PropertyBody asset={asset} txns={txns} commitments={commitments} />}
```

- [ ] **Step 2: Accept the prop and render the section in `PropertyBody`**

In `src/app/(app)/assets/[id]/PropertyBody.tsx`, update imports and the component signature. Change:

```ts
import { runningBalanceCents } from '@/lib/data/assets-shared'
import type { Asset, AssetTxn } from '@/lib/data/assets-shared'
```

to also import the commitment type:

```ts
import { runningBalanceCents } from '@/lib/data/assets-shared'
import type { Asset, AssetTxn } from '@/lib/data/assets-shared'
import type { Commitment } from '@/lib/data/commitments-shared'
```

Change the signature:

```ts
export function PropertyBody({ asset, txns, commitments }: { asset: Asset; txns: AssetTxn[]; commitments: Commitment[] }) {
```

Then, immediately after the closing `</HeroCard>` line, insert the commitments section:

```tsx
      <CommitmentsSection assetId={asset.id} commitments={commitments} />
```

- [ ] **Step 3: Add the `CommitmentsSection` component**

At the bottom of `PropertyBody.tsx` (module scope, e.g. after the `Switch` function), add:

```tsx
function CommitmentsSection({ assetId, commitments }: { assetId: string; commitments: Commitment[] }) {
  const t = useT()
  const total = commitments.reduce((a, c) => a + c.amountCents, 0)
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-[var(--hairline)] px-4 py-3">
        <span className="text-sm font-bold text-[var(--ink-head)]">{t('asset.commitments.title')}</span>
        <Link
          href={`/assets/${assetId}/commitments`}
          className="pressable rounded-full bg-[var(--primary-btn)] px-3 py-1 text-xs font-bold text-white"
        >
          {t('asset.commitments.manage')}
        </Link>
      </div>
      {commitments.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm font-semibold text-[var(--faint)]">{t('asset.commitments.empty')}</p>
      ) : (
        <>
          {commitments.map((c, i) => (
            <div
              key={i}
              className={`flex items-center justify-between px-4 py-3 ${
                i < commitments.length - 1 ? 'border-b border-[var(--hairline)]' : ''
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[var(--ink-head)]">{c.name}</p>
                {c.remark && <p className="truncate text-xs text-[var(--muted)]">{c.remark}</p>}
              </div>
              <MoneyText cents={c.amountCents} className="shrink-0 text-sm font-bold text-[var(--ink-head)]" />
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-[var(--hairline)] bg-[var(--subtle)] px-4 py-3">
            <span className="text-sm font-bold text-[var(--ink-head)]">{t('asset.commitments.total')}</span>
            <MoneyText cents={total} className="text-sm font-extrabold text-[var(--ink-head)]" />
          </div>
        </>
      )}
    </Card>
  )
}
```

(`Link`, `Card`, `MoneyText`, `useT` are already imported in this file.)

- [ ] **Step 4: Verify build + lint**

Run: `npm run lint && npx tsc --noEmit`
Expected: no errors from `page.tsx` / `PropertyBody.tsx`.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/assets/[id]/page.tsx" "src/app/(app)/assets/[id]/PropertyBody.tsx"
git commit -m "feat(assets): show monthly commitments card on property detail"
```

---

### Task 8: Manage screen — route + `CommitmentsManager`

**Files:**
- Create: `src/app/(app)/assets/[id]/commitments/page.tsx`
- Create: `src/app/(app)/assets/[id]/commitments/CommitmentsManager.tsx`

**Interfaces:**
- Consumes: `getCommitmentsRaw(assetId)`, `moveItem`, `CommitmentRow`, and the Task 5 actions.

- [ ] **Step 1: Write the manage page (server component)**

```tsx
// src/app/(app)/assets/[id]/commitments/page.tsx
import { notFound } from 'next/navigation'
import { getAsset } from '@/lib/data/assets'
import { getCommitmentsRaw } from '@/lib/data/commitments'
import { CommitmentsManager } from './CommitmentsManager'

export default async function CommitmentsManagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const asset = await getAsset(id)
  if (!asset) notFound()
  const commitments = await getCommitmentsRaw(id)
  return <CommitmentsManager assetId={id} commitments={commitments} />
}
```

- [ ] **Step 2: Write the `CommitmentsManager` client component**

```tsx
// src/app/(app)/assets/[id]/commitments/CommitmentsManager.tsx
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronUp, ChevronDown, Trash2, Plus } from 'lucide-react'
import { useT } from '@/i18n/LocaleProvider'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { parseMoneyInput } from '@/lib/money'
import { moveItem, type CommitmentRow } from '@/lib/data/commitments-shared'
import { createCommitment, updateCommitment, deleteCommitment, reorderCommitments } from './actions'

export function CommitmentsManager({ assetId, commitments }: { assetId: string; commitments: CommitmentRow[] }) {
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
          href={`/assets/${assetId}`}
          aria-label={t('common.back')}
          className="pressable-opacity grid h-11 w-11 shrink-0 place-items-center text-2xl text-[var(--muted)]"
        >
          ‹
        </Link>
        <h1 className="flex-1 truncate text-xl font-extrabold text-[var(--ink-head)]">{t('asset.commitments.title')}</h1>
      </header>

      {error && (
        <p role="alert" className="rounded-xl bg-[var(--pending-bg)] px-4 py-2 text-sm font-semibold text-[var(--danger)]">
          {t(`error.${error}`)}
        </p>
      )}

      <section className="flex flex-col gap-2">
        {commitments.map((c, i) => (
          <CommitmentEditor
            key={c.id}
            row={c}
            disabled={busy}
            canUp={i > 0}
            canDown={i < commitments.length - 1}
            onSave={(name, amountCents, remark) => run(() => updateCommitment({ id: c.id, assetId, name, amountCents, remark }))}
            onDelete={() => run(() => deleteCommitment({ id: c.id, assetId }))}
            onMove={(delta) => run(() => reorderCommitments({ assetId, orderedIds: moveItem(commitments, i, delta).map((x) => x.id) }))}
          />
        ))}
        <CommitmentAdder
          disabled={busy}
          onAdd={(name, amountCents, remark) => run(() => createCommitment({ assetId, name, amountCents, remark }))}
        />
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

function CommitmentEditor({ row, disabled, canUp, canDown, onSave, onDelete, onMove }: {
  row: CommitmentRow; disabled: boolean; canUp: boolean; canDown: boolean
  onSave: (name: string, amountCents: number, remark: string | null) => void
  onDelete: () => void; onMove: (delta: -1 | 1) => void
}) {
  const t = useT()
  const [name, setName] = useState(row.name)
  const [remark, setRemark] = useState(row.remark ?? '')
  const [amount, setAmount] = useState((row.amountCents / 100).toFixed(2))
  return (
    <Card className="flex items-start gap-2">
      <MoveButtons canUp={canUp} canDown={canDown} disabled={disabled} onMove={onMove} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('asset.commitments.name')}
          className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--ink)] outline-none placeholder:text-[var(--faint)]" />
        <input value={remark} onChange={(e) => setRemark(e.target.value)} placeholder={t('asset.commitments.remarkOptional')}
          className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--faint)]" />
        <div className="flex items-center gap-2">
          <div className="flex w-24 shrink-0 items-center gap-1 rounded-lg border border-[var(--hairline)] bg-[var(--surface)] px-2 py-2">
            <span className="text-xs text-[var(--muted)]">RM</span>
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-transparent text-sm text-[var(--ink)] outline-none" />
          </div>
          <button type="button" disabled={disabled} onClick={() => onSave(name, parseMoneyInput(amount), remark.trim() || null)}
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

function CommitmentAdder({ disabled, onAdd }: { disabled: boolean; onAdd: (name: string, amountCents: number, remark: string | null) => void }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [remark, setRemark] = useState('')
  const [amount, setAmount] = useState('')
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="pressable flex min-h-[44px] w-full items-center justify-center gap-1 rounded-xl border border-dashed border-[var(--primary)] py-3 text-sm font-bold text-[var(--primary)]">
        <Plus size={16} /> {t('asset.commitments.add')}
      </button>
    )
  }
  return (
    <Card className="flex flex-col gap-2">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('asset.commitments.name')}
        className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--faint)]" />
      <input value={remark} onChange={(e) => setRemark(e.target.value)} placeholder={t('asset.commitments.remarkOptional')}
        className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--faint)]" />
      <div className="flex items-center gap-2 rounded-lg border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2">
        <span className="text-xs text-[var(--muted)]">RM</span>
        <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
          className="flex-1 bg-transparent text-sm text-[var(--ink)] outline-none" />
      </div>
      <div className="flex gap-2">
        <button type="button" disabled={disabled || !name.trim()}
          onClick={() => { onAdd(name, parseMoneyInput(amount), remark.trim() || null); setOpen(false); setName(''); setRemark(''); setAmount('') }}
          className="pressable min-h-[40px] flex-1 rounded-lg bg-[var(--primary-btn)] text-sm font-bold text-white disabled:opacity-40">
          {t('asset.commitments.addConfirm')}
        </button>
        <button type="button" onClick={() => setOpen(false)} aria-label={t('common.close')}
          className="pressable-opacity grid h-10 w-10 place-items-center text-xl text-[var(--muted)]">×</button>
      </div>
    </Card>
  )
}
```

- [ ] **Step 3: Verify build + lint**

Run: `npm run lint && npx tsc --noEmit`
Expected: no errors from the new files.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/assets/[id]/commitments/page.tsx" "src/app/(app)/assets/[id]/commitments/CommitmentsManager.tsx"
git commit -m "feat(assets): commitments manage screen (add/edit/delete/reorder)"
```

---

### Task 9: Retire the budget module

**Files:**
- Delete: `src/app/(app)/budget/` (entire directory: `page.tsx`, `actions.ts`, `BudgetBars.tsx`, `loading.tsx`, `manage/page.tsx`, `manage/BudgetManager.tsx`)
- Delete: `src/lib/data/budget.ts`, `src/lib/data/budget-shared.ts`, `src/lib/data/budget-shared.test.ts`
- Modify: `src/lib/nav/nav-shared.ts`, `src/lib/nav/nav-shared.test.ts`
- Modify: `src/components/nav/tab-icons.ts`
- Modify: `src/i18n/dictionaries.ts` (remove `budget.*`)

**Interfaces:**
- Produces: `TabId` no longer includes `'budget'`; `DEFAULT_LAYOUT.bar = ['home','expenses','fund','assets']`, `more = []`.

- [ ] **Step 1: Delete the budget module + data files**

```bash
git rm -r "src/app/(app)/budget"
git rm src/lib/data/budget.ts src/lib/data/budget-shared.ts src/lib/data/budget-shared.test.ts
```

- [ ] **Step 2: Update `nav-shared.ts`**

Remove `budget` from the `TabId` union, `TAB_DEFS`, and `DEFAULT_LAYOUT`.

Change the type:

```ts
export type TabId = 'home' | 'expenses' | 'fund' | 'assets'
```

Remove the budget entry from `TAB_DEFS` (delete this line):

```ts
  { id: 'budget', href: '/budget', i18nKey: 'nav.budget', iconName: 'budget', matchPrefixes: [] },
```

Change `DEFAULT_LAYOUT` (assets promotes into the bar; `more` empties):

```ts
export const DEFAULT_LAYOUT: NavLayout = {
  bar: ['home', 'expenses', 'fund', 'assets'],
  more: [],
}
```

- [ ] **Step 3: Update `tab-icons.ts`**

Remove the `budget` icon entry and the now-unused `ChartColumn` import:

```ts
import { Home, Receipt, HandCoins, LayoutGrid, MoreHorizontal, type LucideIcon } from 'lucide-react'
import type { TabId } from '@/lib/nav/nav-shared'

export const TAB_ICONS: Record<TabId, LucideIcon> = {
  home: Home,
  expenses: Receipt,
  fund: HandCoins,
  assets: LayoutGrid,
}

export const MORE_ICON: LucideIcon = MoreHorizontal
```

- [ ] **Step 4: Update `nav-shared.test.ts` for the budget-less tab set**

Replace the budget-referencing cases. Rewrite these tests to match the new default (`bar: ['home','expenses','fund','assets']`, `more: []`):

```ts
  it('preserves a valid layout unchanged', () => {
    const layout = { bar: ['home', 'fund'], more: ['expenses', 'assets'] }
    expect(parseLayout(layout)).toEqual(layout)
  })
```

```ts
  it('spills over-cap bar items to the front of more', () => {
    const out = parseLayout({
      bar: ['home', 'expenses', 'fund', 'assets', 'home'], more: [],
    })
    expect(out.bar).toHaveLength(MAX_BAR)
    expect(out.bar).toEqual(['home', 'expenses', 'fund', 'assets'])
  })
```

In the `resolveActiveTab` block, drop the `/budget` assertion and adjust the "More slot" / "promoted" cases. Since `assets` is now in the default bar, use a layout where it sits in `more` for the More-slot test:

```ts
  it('matches each bar destination by prefix', () => {
    const l = DEFAULT_LAYOUT
    expect(resolveActiveTab('/', l)).toBe('home')
    expect(resolveActiveTab('/personal', l)).toBe('home')
    expect(resolveActiveTab('/expenses', l)).toBe('expenses')
    expect(resolveActiveTab('/expenses/123', l)).toBe('expenses')
    expect(resolveActiveTab('/fund', l)).toBe('fund')
    expect(resolveActiveTab('/assets', l)).toBe('assets')
  })

  it('resolves the More slot for destinations that live in more', () => {
    const custom: NavLayout = { bar: ['home', 'expenses', 'fund'], more: ['assets'] }
    expect(resolveActiveTab('/assets', custom)).toBe('more')
    expect(resolveActiveTab('/more', custom)).toBe('more')
  })

  it('resolves a promoted destination to its own bar slot', () => {
    const promoted: NavLayout = { bar: ['home', 'assets', 'fund'], more: ['expenses'] }
    expect(resolveActiveTab('/assets', promoted)).toBe('assets')
    expect(resolveActiveTab('/expenses', promoted)).toBe('more')
  })
```

In the `defsFor` block, replace `'budget'` with a still-valid id:

```ts
  it('returns definitions in the given order', () => {
    const defs = defsFor(['assets', 'home'])
    expect(defs.map((d) => d.id)).toEqual(['assets', 'home'])
  })
```

- [ ] **Step 5: Remove `budget.*` keys from `dictionaries.ts`**

Delete both the EN block (`'budget.title'` … `'budget.add'`) and the ZH block (same keys). Also delete the `nav.budget` key in both locales if present.

Run to confirm none remain: `grep -n "'budget\.\|nav.budget" src/i18n/dictionaries.ts`
Expected: no output.

- [ ] **Step 6: Run the full test suite + lint + typecheck**

Run: `npm test && npm run lint && npx tsc --noEmit`
Expected: PASS. No references to `@/lib/data/budget`, `/budget`, or `budget` TabId remain.

Run: `grep -rn "lib/data/budget\|(app)/budget\|'budget'" src/`
Expected: no output (except unrelated substrings — verify each hit is gone).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: retire budget module (route, nav tab, data, i18n)"
```

---

### Task 10: Home — remove budget card, rewire commitments, drop pace helper

**Files:**
- Modify: `src/lib/data/home.ts`
- Modify: `src/app/(app)/page.tsx`
- Modify: `src/lib/data/home-shared.ts`
- Modify: `src/lib/data/home-shared.test.ts`
- Modify: `src/i18n/dictionaries.ts` (remove home budget/pace keys)

**Interfaces:**
- Produces: `HomeSummary` no longer has a `budget` field; `budgetPaceKey` removed; commitments query uses single `name`.

- [ ] **Step 1: Update the `home-shared.test.ts` first (remove pace tests)**

Delete the entire `describe('budgetPaceKey', ...)` block and change the import to:

```ts
import { greetingKey } from './home-shared'
```

Run: `npx vitest run src/lib/data/home-shared.test.ts`
Expected: FAIL — `budgetPaceKey` still exported/imported mismatch is fine; the goal is it fails until Step 2 removes the function. (If it passes because only greeting tests remain, that's acceptable.)

- [ ] **Step 2: Remove `budgetPaceKey` from `home-shared.ts`**

Delete the entire `budgetPaceKey` function (keep `greetingKey`).

Run: `npx vitest run src/lib/data/home-shared.test.ts`
Expected: PASS (greeting tests only).

- [ ] **Step 3: Rewire `home.ts`**

Remove the budget import:

```ts
// delete this line:
import { localizedName } from './budget-shared'
```

Remove `budget` from `HomeSummary` (delete the `budget: { totalCents: number; spentCents: number }` line) and from `emptySummary` (delete `budget: { totalCents: 0, spentCents: 0 },`).

In `getHomeSummary`, remove the `budget_categories` query and the `spentCents`/`budgetRes` wiring. Change the `Promise.all` destructure and body:
- Delete `budgetRes,` from the destructured array and its query (`supabase.from('budget_categories')...`).
- Delete `spentCents,` from the destructure and the `getMonthTotalCents(year, month)` call (only used by the removed budget card). Also remove the now-unused `getMonthTotalCents` import.
- Delete `type BudgetRow`, `const budgetRows`, and `const totalCents`.

Change the commitments query to select the single `name`:

```ts
    supabase
      .from('monthly_commitments')
      .select('name, amount_cents')
      .eq('household_id', householdId),
```

Change the commitment row type and mapping:

```ts
  type CommitmentRow = { name: string; amount_cents: number }
```

```ts
  const commitmentItems: UpcomingItem[] = commitmentRows.map((r) => ({
    icon: 'Zap',
    title: r.name,
    due: t(locale, 'home.due'),
    amountCents: r.amount_cents,
    status: 'upcoming',
  }))
```

Finally, delete `budget: { totalCents, spentCents },` from the returned object.

- [ ] **Step 4: Remove the budget card from the home page**

In `src/app/(app)/page.tsx`:
- Change the import to drop `budgetPaceKey`:

```ts
import { greetingKey } from '@/lib/data/home-shared'
```

- Delete the derived budget vars:

```ts
  const budgetProgress = summary.budget.totalCents > 0 ? summary.budget.spentCents / summary.budget.totalCents : 0
  const budgetLeftCents = summary.budget.totalCents - summary.budget.spentCents
```

- Delete the `mytDay` / `daysInMonth` / `paceKey` lines (only the removed card used them):

```ts
  const mytDay = myt.getUTCDate()
  const daysInMonth = new Date(Date.UTC(myt.getUTCFullYear(), myt.getUTCMonth() + 1, 0)).getUTCDate()
  const paceKey = budgetPaceKey(summary.budget.spentCents, summary.budget.totalCents, mytDay, daysInMonth)
```

- Delete the entire budget `<Card>` block (the one containing `t(locale, 'home.budget')`, from its opening `<Card>` through its matching `</Card>`).

- [ ] **Step 5: Remove home budget/pace i18n keys**

In `src/i18n/dictionaries.ts`, delete these keys in **both** EN and ZH: `home.budget`, `home.onTrack`, `home.overPace`, `home.left`, `home.spent`. Keep `home.due` (still used by commitments).

Run: `grep -rn "home.onTrack\|home.overPace\|'home.budget'\|'home.left'\|'home.spent'" src/`
Expected: no output.

- [ ] **Step 6: Full verification**

Run: `npm test && npm run lint && npx tsc --noEmit`
Expected: PASS, no type errors, no unused-import lint errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(home): remove budget card, rewire commitments to single name"
```

---

### Task 11: Seed — update `seed.sql` and the generator

**Files:**
- Modify: `supabase/seed/seed.sql`
- Modify: `supabase/seed/generate_seed.py`

**Interfaces:**
- Produces: a fresh seed matching the post-migration schema (single `name`, `asset_id`, emoji-free TreeO descriptions).

- [ ] **Step 1: Edit `seed.sql` — remove budget categories**

Delete the 7 `insert into budget_categories(...)` lines (currently lines ~29–35).

- [ ] **Step 2: Edit `seed.sql` — relocate & rewrite commitments after the TreeO asset**

Delete the 8 `insert into monthly_commitments(...)` lines from their current location (~36–43). Re-insert them **immediately after** the TreeO asset insert (`insert into assets(...,'property','TreeO'...)`), rewritten with `asset_id`, single `name`, `remark`, and explicit `sort_order`:

```sql
insert into monthly_commitments(household_id,asset_id,name,amount_cents,remark,sort_order) values ('00000000-0000-0000-0000-0000000000aa','00000000-0000-0000-0000-0000000000b1','House installment',149300,'year 2026',1);
insert into monthly_commitments(household_id,asset_id,name,amount_cents,remark,sort_order) values ('00000000-0000-0000-0000-0000000000aa','00000000-0000-0000-0000-0000000000b1','House maintenance',21320,NULL,2);
insert into monthly_commitments(household_id,asset_id,name,amount_cents,remark,sort_order) values ('00000000-0000-0000-0000-0000000000aa','00000000-0000-0000-0000-0000000000b1','LG water purifier',5000,NULL,3);
insert into monthly_commitments(household_id,asset_id,name,amount_cents,remark,sort_order) values ('00000000-0000-0000-0000-0000000000aa','00000000-0000-0000-0000-0000000000b1','LG air purifier',4000,NULL,4);
insert into monthly_commitments(household_id,asset_id,name,amount_cents,remark,sort_order) values ('00000000-0000-0000-0000-0000000000aa','00000000-0000-0000-0000-0000000000b1','Outdoor water filter',6944,NULL,5);
insert into monthly_commitments(household_id,asset_id,name,amount_cents,remark,sort_order) values ('00000000-0000-0000-0000-0000000000aa','00000000-0000-0000-0000-0000000000b1','Time Fibre Internet',10494,'500 mpbs for 6 months',6);
insert into monthly_commitments(household_id,asset_id,name,amount_cents,remark,sort_order) values ('00000000-0000-0000-0000-0000000000aa','00000000-0000-0000-0000-0000000000b1','Electric Bill',12000,'Estimate',7);
insert into monthly_commitments(household_id,asset_id,name,amount_cents,remark,sort_order) values ('00000000-0000-0000-0000-0000000000aa','00000000-0000-0000-0000-0000000000b1','Water Bill',1500,'Estimate',8);
```

- [ ] **Step 3: Edit `seed.sql` — clean TreeO transaction descriptions**

In the TreeO `asset_transactions` inserts (asset id `...b1`): remove every `💵`, `⚡`, `💧` from the description strings, and rename `'Monthly Commitment💵'` → `'Installment + Maintenance'`. e.g. `'Electric Bill (Jan 2026)⚡'` → `'Electric Bill (Jan 2026)'`, `'Water Bill (Jan, Feb 2026)💧'` → `'Water Bill (Jan, Feb 2026)'`.

Run to confirm no emoji remain: `grep -nP "[\x{1F300}-\x{1FAFF}\x{26A1}]" supabase/seed/seed.sql`
Expected: no output.

- [ ] **Step 4: Update the generator `generate_seed.py`**

Remove the budget-categories emission (the `# Budget categories` loop that appends `insert into budget_categories(...)`).

Move the `# Monthly commitments` loop to **after** the TreeO transactions block (so `A_TREEO` is defined) and rewrite its emission with `asset_id`, single `name`, `remark`, `sort_order`, cleaning emoji from the name:

```python
# Monthly commitments — 'Money breakdown' second table rows 2..9 (cols 7,8,9)
mc_order = 0
for r in range(2, 10):
    name = mb.cell(r, 7).value
    amt = mb.cell(r, 8).value
    if not name or amt is None:
        continue
    mc_order += 1
    clean_name = strip_emoji(str(name))
    out.append(f"insert into monthly_commitments(household_id,asset_id,name,amount_cents,remark,sort_order) "
               f"values ('{HH}','{A_TREEO}',{s(clean_name)},{c(amt)},{s(mb.cell(r, 9).value)},{mc_order});")
```

In the TreeO transactions loop, clean the description and rename the commitment inflow:

```python
    det = to.cell(r, 2).value
    ...
    direction = 'in' if 'Commitment' in str(det) else 'out'
    txn_type = 'monthly_commitment' if direction == 'in' else 'bill'
    desc = 'Installment + Maintenance' if direction == 'in' else strip_emoji(str(det))
    out.append(f"insert into asset_transactions(asset_id,household_id,date,description,amount_cents,direction,txn_type,settled) "
               f"values ('{A_TREEO}','{HH}',{d(to.cell(r, 1).value)},{s(desc)},{c(amt)},'{direction}','{txn_type}',{str(transferred).lower()});")
```

Add a `strip_emoji` helper near the top of the file (after imports):

```python
import re
_EMOJI_RE = re.compile('[\U0001F300-\U0001FAFF☀-➿]')
def strip_emoji(text):
    return _EMOJI_RE.sub('', text).strip()
```

- [ ] **Step 5: Sanity-check the generator**

Run: `python3 -c "import ast; ast.parse(open('supabase/seed/generate_seed.py').read()); print('ok')"`
Expected: `ok` (syntax valid). Full regeneration requires the source workbook and is done manually; this task's authoritative artifact is `seed.sql`.

- [ ] **Step 6: Commit**

```bash
git add supabase/seed/seed.sql supabase/seed/generate_seed.py
git commit -m "chore(seed): asset-scoped commitments, single name, emoji-free TreeO txns"
```

---

## Self-Review

**Spec coverage:**
- Retire budget fully → Task 9 (route/nav/data/i18n) + Task 1 (drop table) + Task 10 (home card). ✅
- Per-asset `asset_id` FK, household_id retained → Task 1. ✅
- Reference-plan display card → Task 7. ✅
- Single free-text name → Task 1 (schema), 3–8 (types/UI), 10 (home), 11 (seed). ✅
- Surface `remark` → Task 4/5/7/8. ✅
- Strip emoji + rename inflow → Task 2 (live data) + Task 11 (seed/generator). ✅
- Manage screen → Task 8. ✅
- Nav bar becomes `home·expenses·fund·assets` → Task 9. ✅

**Placeholder scan:** No TBD/TODO; every code step shows complete code. ✅

**Type consistency:** `Commitment` / `CommitmentRow` defined in Task 3, consumed identically in Tasks 4, 7, 8. Action signatures in Task 5 match the calls in Task 8's `CommitmentsManager`. `getCommitments`/`getCommitmentsRaw` names consistent across Tasks 4, 7, 8. ✅

**Notes for the implementer:**
- Migrations (Tasks 1–2) and seed (Task 11) can't be auto-tested here — verify by SQL review and manual apply in the Supabase SQL editor.
- After Task 9, `npm test` must stay green; the nav test edits in Step 4 are required for that.
