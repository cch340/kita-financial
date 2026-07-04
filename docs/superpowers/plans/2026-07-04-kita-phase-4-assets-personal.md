# Kita — Phase 4: Assets Module & Personal Ledgers — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Build the generic Assets module (handoff `3A` list, `3B`/`3C`/`3D` detail variants, `3E` add-asset) and the Personal ledgers screen (`3F`), wired to household-scoped Supabase data; seed the missing vehicle transactions and `ledger_entries`; light up the Home "Personal ledgers" card.

**Architecture:** Server Components fetch through data-access layers (`assets.ts`, `personal.ts`); pure shaping (per-type key figure, running balance, grouping, monthly-ledger parse) is unit-tested and lives in client-safe modules (no `@/lib/supabase/server` import) so client components can import it. Mutations (add asset, add transaction, toggle transferred, add ledger entry) are Server Actions. The seed generator is extended to parse the Car and CH/JC sheets.

**Tech Stack:** Next.js 16 App Router · Supabase (`@supabase/ssr`) · Tailwind v4 + Kita tokens · Vitest · Python 3 + openpyxl (seed).

## Global Constraints

- **Currency:** `RM 1,234.56` via `MoneyText`/`formatRM`; money is integer **cents** throughout.
- **Data isolation:** every read/write household-scoped via `getMembership()` server-side; never accept a `household_id` from the client. Mutations that target a specific asset/transaction re-scope by `household_id` on the write and verify the asset belongs to the household.
- **Client-safe pure modules:** any pure helper imported by a `'use client'` component MUST live in a module with NO `@/lib/supabase/server` / `next/headers` import (follow the Phase 3 `fund-shared.ts` precedent). Server-only data functions live separately.
- **Generic asset module:** the Asset list + detail are `type`-driven (`property | vehicle | investment | other`). A new asset type must slot in without structural changes.
- **i18n:** all strings via `t()`/`useT()`; new keys in BOTH `en` and `zh` (parity test enforces). DB-sourced names (`assets.name`, transaction `description`, ledger `description`) render as-is (user data, not translated).
- **Tokens only** (no hex): per-type hero tints — property=terracotta (`--hero-grad`), vehicle=blue (`--member-jc`/`--info-*`), investment=sage (`--positive-*`); status badges paid=`--positive-*`, upcoming/pending=`--pending-*`, closed=`--muted`/`--subtle`.
- **Empty-DB resilience:** every screen renders with zero assets / zero transactions / zero ledger entries without crashing; guard every bar width against divide-by-zero.
- **Design source of truth:** `design_handoff_kita/README.md` §3A–3F.

---

## Data Realities

- Seeded assets (Phase 1): TreeO (property, opening 4601381), Myvi + Alza (vehicle, no transactions yet), AIA — CH + AIA — JC (investment, ~7 settled `scheduled_payment` txns each). **Task 3 adds** vehicle transactions (from the Car sheet) and `ledger_entries` (from CH/JC sheets).
- The Car sheet has mixed date formats (`2025-12-31` datetimes AND `14/12/2022` strings) and `CLOSED` markers — the parser must tolerate both and skip non-numeric payment cells.
- CH (Personal) has multiple monthly blocks (Jan–…); JC (Personal) has one (Jan). Each block: a date in col 1, income rows (cols 2/3) and expense rows (cols 6/7) ending at `Total`/`Balance` rows (which are skipped — totals are recomputed).
- **Personal screen anchors to a selected month** with a stepper (like Expenses), defaulting to the latest month that has ledger data (or current month). Since CH has several months and JC has one, a stepper lets both be viewed.
- `ledger_entries` are keyed by `household_id + owner_member_code + period` — they do NOT reference `auth.users`, so the seed inserts need no UUID substitution and can be committed + applied directly.

---

## File Structure (Phase 4)

```
src/
├─ lib/data/
│  ├─ assets-shared.ts         # PURE types + key-figure/balance/grouping helpers (client-safe)
│  ├─ assets-shared.test.ts
│  ├─ assets.ts                # getAssetsList, getAsset (server)
│  ├─ personal-shared.ts       # PURE ledger types + totals/balance (client-safe)
│  ├─ personal-shared.test.ts
│  └─ personal.ts              # getPersonalLedger, getPersonalBalances (server)
├─ app/(app)/
│  ├─ assets/
│  │  ├─ page.tsx              # Assets list (3A)
│  │  ├─ actions.ts            # addAssetTransaction, toggleTransferred
│  │  ├─ [id]/page.tsx         # Asset detail router (3B/3C/3D by type)
│  │  ├─ [id]/PropertyBody.tsx # 3B (client: transferred toggle)
│  │  ├─ [id]/VehicleBody.tsx  # 3C
│  │  ├─ [id]/InvestmentBody.tsx # 3D
│  │  ├─ [id]/AddTxn.tsx       # add-transaction form (client)
│  │  └─ new/
│  │     ├─ page.tsx           # Add asset (3E)
│  │     ├─ AddAssetForm.tsx   # client: type grid + adaptive fields
│  │     └─ actions.ts         # createAsset
│  ├─ personal/
│  │  ├─ page.tsx              # Personal (3F)
│  │  ├─ PersonalView.tsx      # client: CH/JC switch, month stepper
│  │  └─ actions.ts            # addLedgerEntry
│  └─ page.tsx                 # MODIFIED: Home personal card shows balances + links to /personal
├─ components/nav/BottomTabBar.tsx  # MODIFIED: Home tab active also on /personal
supabase/seed/
├─ generate_seed.py            # MODIFIED: + vehicle txns + ledger_entries
├─ seed.sql                    # regenerated (full, fresh installs)
└─ seed-phase4.sql             # NEW committed: vehicle txns + ledger only (for users who already applied Phase 1)
```

---

## Task 1: Assets data layer (pure helpers + server reads)

**Files:**
- Create: `src/lib/data/assets-shared.ts`, `src/lib/data/assets-shared.test.ts`, `src/lib/data/assets.ts`

**Interfaces:**
- Produces (in `assets-shared.ts`, PURE):
  - `type AssetType = 'property' | 'vehicle' | 'investment' | 'other'`
  - `type AssetTxn = { id: string; date: string; description: string | null; amountCents: number; direction: 'in' | 'out'; txnType: string | null; settled: boolean; seq: number | null; notes: string | null }`
  - `type Asset = { id: string; type: AssetType; name: string; ownerMemberCode: 'CH'|'JC'|null; status: 'active'|'closed'; openingBalanceCents: number | null; metadata: Record<string, unknown> }`
  - `type KeyFigure = { label: 'balance' | 'next_payment' | 'paid'; amountCents: number }`
  - `runningBalanceCents(openingCents: number | null, txns: AssetTxn[]): number` — `opening + Σin − Σout`
  - `totalSettledOutCents(txns): number` — Σ amount where `settled && direction==='out'`
  - `nextPaymentCents(txns): number` — amount of the earliest **unsettled** txn by date; `0` if none
  - `assetKeyFigure(asset, txns): KeyFigure` — property/other→balance, investment→paid (totalSettledOut), vehicle→next_payment
  - `groupByTxnType(txns): { txnType: string; rows: AssetTxn[] }[]` — stable order by first appearance
- Produces (in `assets.ts`, SERVER):
  - `getAssetsList(): Promise<{ type: AssetType; assets: (Asset & { key: KeyFigure })[] }[]>` — grouped by type, each asset with its key figure; type order property, vehicle, investment, other.
  - `getAsset(id): Promise<{ asset: Asset; txns: AssetTxn[] } | null>` — household-scoped.

- [ ] **Step 1: Write failing tests** (`assets-shared.test.ts`)

```ts
import { describe, it, expect } from 'vitest'
import { runningBalanceCents, totalSettledOutCents, nextPaymentCents, assetKeyFigure, groupByTxnType } from './assets-shared'
import type { AssetTxn, Asset } from './assets-shared'

const tx = (p: Partial<AssetTxn>): AssetTxn => ({
  id: p.id ?? 'x', date: p.date ?? '2026-01-01', description: null,
  amountCents: p.amountCents ?? 0, direction: p.direction ?? 'out',
  txnType: p.txnType ?? null, settled: p.settled ?? false, seq: p.seq ?? null, notes: null,
})

describe('runningBalanceCents', () => {
  it('opening + in - out', () => {
    expect(runningBalanceCents(100000, [tx({ direction: 'in', amountCents: 5000 }), tx({ direction: 'out', amountCents: 2000 })])).toBe(103000)
    expect(runningBalanceCents(null, [])).toBe(0)
  })
})
describe('totalSettledOutCents', () => {
  it('sums settled out only', () => {
    expect(totalSettledOutCents([tx({ direction: 'out', amountCents: 3000, settled: true }), tx({ direction: 'out', amountCents: 999, settled: false }), tx({ direction: 'in', amountCents: 100, settled: true })])).toBe(3000)
  })
})
describe('nextPaymentCents', () => {
  it('earliest unsettled by date, 0 when none', () => {
    expect(nextPaymentCents([tx({ date: '2026-03-01', amountCents: 500, settled: false }), tx({ date: '2026-02-01', amountCents: 700, settled: false }), tx({ date: '2026-01-01', amountCents: 900, settled: true })])).toBe(700)
    expect(nextPaymentCents([tx({ settled: true, amountCents: 100 })])).toBe(0)
  })
})
describe('assetKeyFigure', () => {
  const base: Asset = { id: 'a', type: 'property', name: 'T', ownerMemberCode: null, status: 'active', openingBalanceCents: 100000, metadata: {} }
  it('property -> balance, investment -> paid, vehicle -> next_payment', () => {
    expect(assetKeyFigure(base, [tx({ direction: 'in', amountCents: 5000 })])).toEqual({ label: 'balance', amountCents: 105000 })
    expect(assetKeyFigure({ ...base, type: 'investment', openingBalanceCents: null }, [tx({ direction: 'out', amountCents: 3600, settled: true })])).toEqual({ label: 'paid', amountCents: 3600 })
    expect(assetKeyFigure({ ...base, type: 'vehicle', openingBalanceCents: null }, [tx({ date: '2026-05-01', amountCents: 620, settled: false })])).toEqual({ label: 'next_payment', amountCents: 620 })
  })
})
describe('groupByTxnType', () => {
  it('groups preserving first-seen order', () => {
    const g = groupByTxnType([tx({ txnType: 'loan' }), tx({ txnType: 'maintenance' }), tx({ txnType: 'loan' })])
    expect(g.map((x) => x.txnType)).toEqual(['loan', 'maintenance'])
    expect(g[0].rows).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run to verify fail** — `npm test` → FAIL (`./assets-shared` not found).

- [ ] **Step 3: Implement `assets-shared.ts`**

```ts
export type AssetType = 'property' | 'vehicle' | 'investment' | 'other'
export type AssetTxn = {
  id: string; date: string; description: string | null; amountCents: number
  direction: 'in' | 'out'; txnType: string | null; settled: boolean; seq: number | null; notes: string | null
}
export type Asset = {
  id: string; type: AssetType; name: string; ownerMemberCode: 'CH' | 'JC' | null
  status: 'active' | 'closed'; openingBalanceCents: number | null; metadata: Record<string, unknown>
}
export type KeyFigure = { label: 'balance' | 'next_payment' | 'paid'; amountCents: number }

export function runningBalanceCents(openingCents: number | null, txns: AssetTxn[]): number {
  return (openingCents ?? 0) + txns.reduce((a, t) => a + (t.direction === 'in' ? t.amountCents : -t.amountCents), 0)
}
export function totalSettledOutCents(txns: AssetTxn[]): number {
  return txns.filter((t) => t.settled && t.direction === 'out').reduce((a, t) => a + t.amountCents, 0)
}
export function nextPaymentCents(txns: AssetTxn[]): number {
  const unsettled = txns.filter((t) => !t.settled).slice().sort((a, b) => (a.date < b.date ? -1 : 1))
  return unsettled.length ? unsettled[0].amountCents : 0
}
export function assetKeyFigure(asset: Asset, txns: AssetTxn[]): KeyFigure {
  if (asset.type === 'investment') return { label: 'paid', amountCents: totalSettledOutCents(txns) }
  if (asset.type === 'vehicle') return { label: 'next_payment', amountCents: nextPaymentCents(txns) }
  return { label: 'balance', amountCents: runningBalanceCents(asset.openingBalanceCents, txns) }
}
export function groupByTxnType(txns: AssetTxn[]): { txnType: string; rows: AssetTxn[] }[] {
  const order: string[] = []
  const map = new Map<string, AssetTxn[]>()
  for (const t of txns) {
    const k = t.txnType ?? 'other'
    if (!map.has(k)) { map.set(k, []); order.push(k) }
    map.get(k)!.push(t)
  }
  return order.map((k) => ({ txnType: k, rows: map.get(k)! }))
}
```

- [ ] **Step 4: Run to verify pass** — `npm test` → PASS.

- [ ] **Step 5: Implement `assets.ts` (server)**

```ts
import { createClient } from '@/lib/supabase/server'
import { getMembership } from './household'
import { assetKeyFigure, type Asset, type AssetTxn, type AssetType, type KeyFigure } from './assets-shared'

const TYPE_ORDER: AssetType[] = ['property', 'vehicle', 'investment', 'other']
const ASSET_COLS = 'id, type, name, owner_member_code, status, opening_balance_cents, metadata'
const TXN_COLS = 'id, date, description, amount_cents, direction, txn_type, settled, seq, notes'

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
    txnType: (r.txn_type as string | null) ?? null, settled: r.settled as boolean,
    seq: (r.seq as number | null) ?? null, notes: (r.notes as string | null) ?? null,
  }
}

export async function getAssetsList(): Promise<{ type: AssetType; assets: (Asset & { key: KeyFigure })[] }[]> {
  const m = await getMembership()
  if (!m) return []
  const supabase = await createClient()
  const [assetsRes, txnsRes] = await Promise.all([
    supabase.from('assets').select(ASSET_COLS).eq('household_id', m.householdId).order('sort_order', { ascending: true }),
    supabase.from('asset_transactions').select('asset_id, ' + TXN_COLS).eq('household_id', m.householdId),
  ])
  if (assetsRes.error) console.error('getAssetsList assets:', assetsRes.error.message)
  if (txnsRes.error) console.error('getAssetsList txns:', txnsRes.error.message)
  const assets = (assetsRes.data ?? []).map(mapAsset)
  const txnRows = (txnsRes.data ?? []) as (Record<string, unknown> & { asset_id: string })[]
  const byAsset = new Map<string, AssetTxn[]>()
  for (const r of txnRows) {
    const list = byAsset.get(r.asset_id) ?? []
    list.push(mapTxn(r)); byAsset.set(r.asset_id, list)
  }
  const withKey = assets.map((a) => ({ ...a, key: assetKeyFigure(a, byAsset.get(a.id) ?? []) }))
  return TYPE_ORDER.map((type) => ({ type, assets: withKey.filter((a) => a.type === type) })).filter((g) => g.assets.length > 0)
}

export async function getAsset(id: string): Promise<{ asset: Asset; txns: AssetTxn[] } | null> {
  const m = await getMembership()
  if (!m) return null
  const supabase = await createClient()
  const { data: aRow, error: aErr } = await supabase
    .from('assets').select(ASSET_COLS).eq('household_id', m.householdId).eq('id', id).single()
  if (aErr || !aRow) { if (aErr) console.error('getAsset:', aErr.message); return null }
  const { data: tRows, error: tErr } = await supabase
    .from('asset_transactions').select(TXN_COLS).eq('household_id', m.householdId).eq('asset_id', id)
    .order('date', { ascending: false })
  if (tErr) console.error('getAsset txns:', tErr.message)
  return { asset: mapAsset(aRow), txns: (tRows ?? []).map(mapTxn) }
}
```

- [ ] **Step 6: Verify + commit** — `npm test`, `npx tsc --noEmit`, `npm run build`.

```bash
git add src/lib/data/assets-shared.ts src/lib/data/assets-shared.test.ts src/lib/data/assets.ts
git commit -m "feat: assets data layer (pure key-figure/balance helpers + server reads)"
```

---

## Task 2: Asset server actions

**Files:**
- Create: `src/app/(app)/assets/actions.ts`, `src/app/(app)/assets/new/actions.ts`

**Interfaces:**
- Produces:
  - `createAsset(input: { type: AssetType; name: string; ownerMemberCode?: 'CH'|'JC'|null; openingBalanceCents?: number|null; metadata?: Record<string, unknown> }): Promise<{ ok: boolean; id?: string; error?: string }>` (in `new/actions.ts`) — inserts a household-scoped asset; redirects handled by the form.
  - `addAssetTransaction(input: { assetId: string; date: string; description: string|null; amountCents: number; direction: 'in'|'out'; txnType: string|null; settled: boolean }): Promise<{ ok: boolean; error?: string }>` (in `assets/actions.ts`) — verifies the asset is in the caller's household, inserts the txn, revalidates.
  - `toggleTransferred(txnId: string): Promise<{ ok: boolean }>` (in `assets/actions.ts`) — flips `settled` on a txn scoped to the household.

- [ ] **Step 1: Implement `assets/actions.ts`**

```ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { getMembership } from '@/lib/data/household'
import { revalidatePath } from 'next/cache'

export async function addAssetTransaction(input: {
  assetId: string; date: string; description: string | null; amountCents: number
  direction: 'in' | 'out'; txnType: string | null; settled: boolean
}): Promise<{ ok: boolean; error?: string }> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) return { ok: false, error: 'invalid_amount' }
  const supabase = await createClient()
  // verify asset belongs to this household
  const { data: asset } = await supabase.from('assets').select('id').eq('household_id', m.householdId).eq('id', input.assetId).single()
  if (!asset) return { ok: false, error: 'not_found' }
  const { error } = await supabase.from('asset_transactions').insert({
    asset_id: input.assetId, household_id: m.householdId, date: input.date,
    description: input.description, amount_cents: input.amountCents, direction: input.direction,
    txn_type: input.txnType, settled: input.settled,
  })
  if (error) { console.error('addAssetTransaction:', error.message); return { ok: false, error: 'save_failed' } }
  revalidatePath(`/assets/${input.assetId}`); revalidatePath('/assets')
  return { ok: true }
}

export async function toggleTransferred(txnId: string): Promise<{ ok: boolean }> {
  const m = await getMembership()
  if (!m) return { ok: false }
  const supabase = await createClient()
  const { data, error } = await supabase.from('asset_transactions')
    .select('id, settled, asset_id').eq('household_id', m.householdId).eq('id', txnId).single()
  if (error || !data) { if (error) console.error('toggleTransferred read:', error.message); return { ok: false } }
  const { error: upErr } = await supabase.from('asset_transactions')
    .update({ settled: !data.settled }).eq('id', txnId).eq('household_id', m.householdId)
  if (upErr) { console.error('toggleTransferred update:', upErr.message); return { ok: false } }
  revalidatePath(`/assets/${data.asset_id}`); revalidatePath('/assets')
  return { ok: true }
}
```

- [ ] **Step 2: Implement `new/actions.ts`**

```ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { getMembership } from '@/lib/data/household'
import { revalidatePath } from 'next/cache'
import type { AssetType } from '@/lib/data/assets-shared'

export async function createAsset(input: {
  type: AssetType; name: string; ownerMemberCode?: 'CH' | 'JC' | null
  openingBalanceCents?: number | null; metadata?: Record<string, unknown>
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }
  if (!input.name.trim()) return { ok: false, error: 'invalid_name' }
  const supabase = await createClient()
  const { data, error } = await supabase.from('assets').insert({
    household_id: m.householdId, type: input.type, name: input.name.trim(),
    owner_member_code: input.ownerMemberCode ?? null,
    opening_balance_cents: input.openingBalanceCents ?? null, metadata: input.metadata ?? {},
  }).select('id').single()
  if (error || !data) { console.error('createAsset:', error?.message); return { ok: false, error: 'save_failed' } }
  revalidatePath('/assets')
  return { ok: true, id: data.id }
}
```

- [ ] **Step 3: Verify + commit** — `npx tsc --noEmit`, `npm run build`.

```bash
git add src/app/\(app\)/assets/actions.ts src/app/\(app\)/assets/new/actions.ts
git commit -m "feat: asset server actions (createAsset, addAssetTransaction, toggleTransferred)"
```

---

## Task 3: Seed extension — vehicle transactions + ledger_entries

**Files:**
- Modify: `supabase/seed/generate_seed.py`
- Create (regenerated): `supabase/seed/seed.sql` (full), `supabase/seed/seed-phase4.sql` (vehicle txns + ledger only)
- Modify: `SETUP.md` (note to apply `seed-phase4.sql`)

**Interfaces:**
- Consumes: `tmp/Financial Report 2026.xlsx`, the Car sheet, CH/JC (Personal) sheets, and the fixed asset ids `A_MYVI`/`A_ALZA` already defined in the generator.
- Produces: additional `asset_transactions` for Myvi/Alza (from the Car sheet's Bank/Loan, Road Tax + Insurance, Maintenance sub-columns) and `ledger_entries` for CH/JC. Both are also written to `seed-phase4.sql` for incremental apply. `ledger_entries` need no UUID substitution.

- [ ] **Step 1: Extend `generate_seed.py`**

Add a helper to parse a `dd/mm/yyyy`-or-datetime date to `YYYY-MM-DD` (return NULL-literal string if unparseable), then:

- **Vehicle transactions** — the Car sheet has, per car block (Myvi = left cols 1-8, Alza = right cols starting at the "Alza" header column; inspect the sheet to find the Alza block's starting column), three sub-tables: **Bank/Loan** (date, payment), **Road Tax + Insurance** (date, payment), **Maintenance** (date, payment), plus a **Loan Payback** column. For each numeric payment row, emit an `asset_transactions` insert: `asset_id` = the car's id, `direction='out'`, `settled=true`, `txn_type` in (`loan`|`road_tax_insurance`|`maintenance`|`loan_payback`), `date` = parsed date (or NULL→use the sheet's carry date; if truly absent, skip the row), `amount_cents` = round(payment*100), `description` = the sub-table label. Skip cells that are non-numeric (`CLOSED`, headers, blanks). If a car's Loan Payback shows `CLOSED`, also emit nothing extra (the asset `status` stays active; optionally set closed — keep simple: leave active).
- **Ledger entries** — iterate the CH and JC (Personal) sheets. Track the current `period` from a date found in col 1. Within each monthly block: an **income** row = col 2 (description, not `Total`) + col 3 (numeric amount) → `entry_type='income'`; an **expense** row = col 6 (description, not `Total`/`Balance`) + col 7 (numeric amount) → `entry_type='expense'`. Emit `ledger_entries(household_id, owner_member_code, period, entry_type, description, amount_cents, remark)` with `owner_member_code` = 'CH'/'JC' per sheet, `remark` = the row's remark col if present. Skip rows where the amount is missing/non-numeric.

Collect the vehicle-txn and ledger inserts into a separate list `phase4` as well as the main `out`, and at the end write BOTH files:

```python
# ... after building `out` (full) and `phase4` (vehicle txns + ledger) ...
import sys
with open('supabase/seed/seed-phase4.sql', 'w') as f:
    f.write('\n'.join(phase4) + '\n')
sys.stdout.write('\n'.join(out) + '\n')   # full seed.sql via redirect
```

Keep the existing full-seed output behavior (`generate_seed.py > seed.sql`).

- [ ] **Step 2: Regenerate both files**

```bash
python3 supabase/seed/generate_seed.py > supabase/seed/seed.sql
head -5 supabase/seed/seed-phase4.sql
echo "vehicle txns: $(grep -c "insert into asset_transactions" supabase/seed/seed-phase4.sql)"
echo "ledger rows: $(grep -c "insert into ledger_entries" supabase/seed/seed-phase4.sql)"
grep -c "insert into" supabase/seed/seed.sql   # should now be higher than before
```

Expected: `seed-phase4.sql` contains only `asset_transactions` (vehicle) + `ledger_entries` inserts, no `:CH_UID`/`:JC_UID` placeholders (grep to confirm absence). `ledger rows` > 15 (CH multiple months + JC one).

- [ ] **Step 3: Update `SETUP.md`** — add a short "Phase 4 data (already-seeded households)" note: users who already applied the Phase 1 seed should run `supabase/seed/seed-phase4.sql` once in the SQL editor to add vehicle payment history + personal ledger entries. Fresh installs get everything from `seed.sql`.

- [ ] **Step 4: Commit**

```bash
git add supabase/seed/generate_seed.py supabase/seed/seed.sql supabase/seed/seed-phase4.sql SETUP.md
git commit -m "feat: seed vehicle transactions + ledger_entries (+ incremental seed-phase4.sql)"
```

---

## Task 4: Assets list (3A) + Add asset (3E)

**Files:**
- Create: `src/app/(app)/assets/page.tsx`, `src/app/(app)/assets/new/page.tsx`, `src/app/(app)/assets/new/AddAssetForm.tsx`
- Add i18n keys (en+zh): `assets.title`, `assets.add`, `assets.type.property`, `assets.type.vehicle`, `assets.type.investment`, `assets.type.other`, `assets.key.balance`, `assets.key.next_payment`, `assets.key.paid`, `assets.name`, `assets.create`, `assets.field.startingBalance`, `assets.field.monthlyCommitment`, `assets.field.address`, `assets.field.loanAmount`, `assets.field.installment`, `assets.field.plate`, `assets.field.yearlyPremium`, `assets.field.years`, `assets.field.holder`, `assets.field.notes`.

**Recreate handoff §3A** (`assets/page.tsx`, server): `getAssetsList()`. Title `t('assets.title')` + an `＋ {t('assets.add')}` button linking `/assets/new`. For each returned type group: an uppercase section header (`t('assets.type.<type>')`) and a card per asset — `IconTile` (icon per type: property=`Home`/`Building`, vehicle=`Car`, investment=`ShieldCheck`, other=`PiggyBank`; add any missing to the `ICONS` record) · name · a meta line (owner or metadata subtitle) · the **key figure** `MoneyText(key.amountCents)` + its label `t('assets.key.<key.label>')` · a chevron. The whole card is a `<Link href={/assets/${id}}>`. Empty (no assets) → a friendly empty state. Assets tab active automatically.

**Recreate handoff §3E** (`assets/new/page.tsx` + `AddAssetForm.tsx`, client): full-screen (`fixed inset-0 z-50` like Add Expense). Header (`×` close → `/assets` · `t('assets.add')`). **Choose a type** — 2×2 grid of chips (`property/vehicle/investment/other`, single-select terracotta). **Asset name** input (placeholder hints the chosen type). A **type-specific field list** that changes with `newType`:
- property → Starting balance (money input → cents) · Monthly commitment · Address/unit
- vehicle → Loan amount · Monthly installment · Plate number
- investment → Yearly premium · Number of years · Policy holder (CH/JC)
- other → Starting balance · Notes
On submit, call `createAsset({ type, name, ownerMemberCode, openingBalanceCents, metadata })` mapping the visible fields into `metadata` (e.g. `{ plate }`, `{ address }`, `{ years }`) and `openingBalanceCents` from the starting-balance/loan field; on `ok` `router.push('/assets/' + id)`, on failure show `t('error.save_failed')`. Money inputs use a simple decimal→cents parse (`Math.round(parseFloat(v||'0')*100)`).

- [ ] **Step 1: Add i18n keys (en + zh).**
- [ ] **Step 2: Build `assets/page.tsx` (3A).**
- [ ] **Step 3: Build `assets/new/` (3E).**
- [ ] **Step 4: Verify + commit** — `npm test`, `npx tsc --noEmit`, `npm run build` (routes `/assets`, `/assets/new`).

```bash
git add src/app/\(app\)/assets/page.tsx src/app/\(app\)/assets/new src/i18n/dictionaries.ts src/components/ui/IconTile.tsx
git commit -m "feat: Assets list (3A) + Add asset (3E) generic flow"
```

---

## Task 5: Asset detail (3B property / 3C vehicle / 3D investment)

**Files:**
- Create: `src/app/(app)/assets/[id]/page.tsx`, `PropertyBody.tsx`, `VehicleBody.tsx`, `InvestmentBody.tsx`, `AddTxn.tsx`
- Add i18n keys (en+zh): `asset.transferred`, `asset.in`, `asset.out`, `asset.balance`, `asset.nextPayment`, `asset.totalPaid`, `asset.addTxn`, `asset.of`, `asset.status.paid`, `asset.status.upcoming`, `asset.status.closed`.

**Recreate the handoff shared detail skeleton + per-type body.** `[id]/page.tsx` (server): `getAsset(id)` (404 via `notFound()` if null); render a back header (name + `t('assets.type.<type>')`), then dispatch by `asset.type` to the matching body, then an `＋ {t('asset.addTxn')}` control (opens `AddTxn`).

- **§3B PropertyBody** (client, needs the transferred toggle): hero (terracotta `--hero-grad`) `t('asset.balance')` = `MoneyText(runningBalanceCents(opening, txns))`. Body = each txn as a card: a direction icon (`ArrowDown` sage for `in`, `ArrowUp` terracotta for `out`) · `description` · `date · t(asset.in|asset.out)` · signed `MoneyText` (prefix `+`/`−`); plus a bottom row `t('asset.transferred') + Switch` bound to `settled`, calling `toggleTransferred(txn.id)` (on `!ok` show `t('error.save_failed')`).
- **§3C VehicleBody** (server ok): hero (blue) `t('asset.nextPayment')` = `MoneyText(nextPaymentCents(txns))` (or a "paid up" note if 0). Body = `groupByTxnType(txns)`; each group a `Card` with an uppercase header (localize known txn types via `asset.*`, else raw), rows: label/description · date · `MoneyText` · a status badge — `settled`→closed/paid style, unsettled→upcoming. (Use `StatusChip` where it fits.)
- **§3D InvestmentBody** (server ok): hero (sage `--positive-*`) `t('asset.totalPaid')` = `MoneyText(totalSettledOutCents(txns))`, muted `{t('asset.of')} MoneyText(sum of ALL txn amounts)`, a `ProgressBar value={sumAll>0 ? paid/sumAll : 0}`. Body = numbered schedule sorted by `seq` (fallback date): each row a number badge (`seq`) · year (from `date`) · status (settled→paid sage, else upcoming amber) · `MoneyText`.
- **AddTxn** (client): a compact form (date default today, description, amount→cents, direction in/out, optional txnType for vehicles) calling `addAssetTransaction({...})`; on `ok` it revalidates (Server Action does) — can be a `<details>`/inline panel or a small route; keep it a client panel toggled open on the detail page.

- [ ] **Step 1: Add i18n keys (en + zh).**
- [ ] **Step 2: Build `[id]/page.tsx` dispatcher + the three bodies + AddTxn.**
- [ ] **Step 3: Verify + commit** — `npm test`, `npx tsc --noEmit`, `npm run build` (route `/assets/[id]`).

```bash
git add src/app/\(app\)/assets/\[id\] src/i18n/dictionaries.ts
git commit -m "feat: asset detail 3B/3C/3D (property/vehicle/investment) + add transaction"
```

---

## Task 6: Personal ledgers (3F) + Home card wiring

**Files:**
- Create: `src/lib/data/personal-shared.ts`, `personal-shared.test.ts`, `src/lib/data/personal.ts`, `src/app/(app)/personal/page.tsx`, `PersonalView.tsx`, `actions.ts`
- Modify: `src/app/(app)/page.tsx` (Home personal card → balances + link), `src/components/nav/BottomTabBar.tsx` (Home active on `/personal`)
- Add i18n keys (en+zh): `personal.title`, `personal.income`, `personal.expenses`, `personal.balance`, `personal.addEntry`, `personal.empty`.

**Interfaces:**
- `personal-shared.ts` (PURE): `type LedgerEntry = { id: string; ownerMemberCode: 'CH'|'JC'; period: string; entryType: 'income'|'expense'; description: string; amountCents: number; remark: string | null }`; `sumByType(entries, type): number`; `balanceCents(entries): number` (income − expense).
- `personal.ts` (SERVER): `getPersonalLedger(member: 'CH'|'JC', year: number, month: number): Promise<{ income: LedgerEntry[]; expenses: LedgerEntry[]; incomeCents: number; expensesCents: number; balanceCents: number; availableMonths: string[] }>` (availableMonths = distinct periods that member has, for the stepper); `getPersonalBalances(year, month): Promise<{ CH: number; JC: number }>` (current-month balance per member, for Home).
- `actions.ts`: `addLedgerEntry(input: { member: 'CH'|'JC'; period: string; entryType: 'income'|'expense'; description: string; amountCents: number }): Promise<{ ok: boolean; error?: string }>`.

- [ ] **Step 1: TDD `personal-shared.ts`** — write `personal-shared.test.ts` asserting `sumByType` and `balanceCents` (income − expense), run FAIL → implement → PASS.

```ts
// test
import { describe, it, expect } from 'vitest'
import { sumByType, balanceCents } from './personal-shared'
import type { LedgerEntry } from './personal-shared'
const e = (entryType: 'income'|'expense', amountCents: number): LedgerEntry =>
  ({ id: 'x', ownerMemberCode: 'CH', period: '2026-01-01', entryType, description: 'd', amountCents, remark: null })
describe('personal-shared', () => {
  it('sumByType and balance', () => {
    const rows = [e('income', 10000), e('income', 5000), e('expense', 3000)]
    expect(sumByType(rows, 'income')).toBe(15000)
    expect(sumByType(rows, 'expense')).toBe(3000)
    expect(balanceCents(rows)).toBe(12000)
  })
})
```

```ts
// impl
export type LedgerEntry = { id: string; ownerMemberCode: 'CH' | 'JC'; period: string; entryType: 'income' | 'expense'; description: string; amountCents: number; remark: string | null }
export const sumByType = (entries: LedgerEntry[], type: 'income' | 'expense') =>
  entries.filter((e) => e.entryType === type).reduce((a, e) => a + e.amountCents, 0)
export const balanceCents = (entries: LedgerEntry[]) => sumByType(entries, 'income') - sumByType(entries, 'expense')
```

- [ ] **Step 2: Implement `personal.ts` (server)** — household-scoped queries; `getPersonalLedger` filters `owner_member_code=member` and `period` = `monthRange(year,month).startISO`; `availableMonths` = `select distinct period` for that member ordered desc. `getPersonalBalances` runs both members for the given month.

- [ ] **Step 3: Implement `personal/actions.ts`** — `addLedgerEntry` inserts household-scoped (`getMembership`), validates amount > 0, `revalidatePath('/personal')` + `revalidatePath('/')`.

- [ ] **Step 4: Build Personal screen §3F** — `page.tsx` (server) reads `?member=&y=&m=` (default member from membership.memberCode, default latest available month or current); `PersonalView` (client): a **CH/JC segmented switch** (selected = member color) that navigates `/personal?member=..`, a **month stepper** (reuse `formatMonthYear`), an **Income** `Card` (rows + `MoneyText(incomeCents)` sage total), an **Expenses** `Card` (rows + `MoneyText(expensesCents)` terracotta total), a **Balance hero** (`HeroCard`, `MoneyText(balanceCents)`), and a dashed **＋ {t('personal.addEntry')}** button opening an inline add-entry form (income/expense toggle, description, amount→cents) calling `addLedgerEntry`. Empty month → `t('personal.empty')`.

- [ ] **Step 5: Wire Home personal card** — in `src/app/(app)/page.tsx`, call `getPersonalBalances(year, month)`; make the Personal ledgers `Card` a `<Link href="/personal">` showing `CH MoneyText · JC MoneyText`. Update `BottomTabBar` active logic so Home is active when `path === '/' || path.startsWith('/personal')`.

- [ ] **Step 6: Verify + commit** — `npm test` (personal + parity), `npx tsc --noEmit`, `npm run build` (route `/personal`).

```bash
git add src/lib/data/personal-shared.ts src/lib/data/personal-shared.test.ts src/lib/data/personal.ts src/app/\(app\)/personal src/app/\(app\)/page.tsx src/components/nav/BottomTabBar.tsx src/i18n/dictionaries.ts
git commit -m "feat: Personal ledgers (3F) + Home personal-card balances"
```

---

## Phase 4 Done — Definition of Done

- `/assets` lists household assets grouped by type, each with its correct key figure (property balance, vehicle next payment, investment paid); tapping opens the type-appropriate detail.
- `/assets/[id]` renders 3B/3C/3D per type: property running balance with per-txn Transferred toggle; vehicle payment history grouped by type with status badges; investment numbered schedule with paid/upcoming.
- `/assets/new` creates an asset of any type with adaptive fields and lands on its detail.
- `/personal` shows CH/JC ledgers (income/expense/balance) with a member switch + month stepper and an add-entry flow; Home's Personal card shows both balances and links here.
- Seed extension adds vehicle payment history + `ledger_entries` (via `seed-phase4.sql` for existing households).
- All new strings EN + 中文 (parity green); money via `MoneyText`; no divide-by-zero; empty states render.
- `npm test` green; `npm run build` succeeds.

Next: **Phase 5** (Settings `3G` + PWA install + push reminders `3H`).
```
