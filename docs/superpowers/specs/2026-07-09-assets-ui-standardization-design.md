# Assets UI Standardization — Design

**Date:** 2026-07-09
**Status:** Approved design, pending spec review
**Scope:** The assets module — asset detail screen, asset list key figure, add/edit-transaction forms, and a new user-managed transaction-category model.

## 1. Goal

Replace the four per-type asset body components with **one uniform UI** rendered identically for every asset type (`property`, `vehicle`, `investment`, `other`). Drivers, all confirmed with the user: consistent look & feel, less code to maintain, easier to add new asset types, and a simpler mental model for users.

Today the data model is already generic (one `assets` table + one `asset_transactions` table); only the *presentation* forks by `type`. This work removes that fork.

## 2. Current state (what exists today)

- **`src/app/(app)/assets/[id]/page.tsx`** branches on `asset.type` and renders one of four bodies:
  - `PropertyBody.tsx` — running-balance hero, "Transferred" settle toggle per row, collapsible Commitments card, opening-balance line.
  - `VehicleBody.tsx` — "Next payment" hero, transactions grouped by `txn_type`, paid/upcoming `StatusChip`.
  - `InvestmentBody.tsx` — "Total paid" hero + progress bar, numbered payment schedule.
  - `GenericBody` (inline in `page.tsx`) — plain description/amount list.
- **`src/lib/data/assets-shared.ts`** holds pure helpers: `runningBalanceCents`, `nextPaymentCents`, `totalSettledOutCents`, `assetKeyFigure` (per-type figure), `groupByTxnType`, `validateTxnInput`, `splitByStatus`.
- **`asset_transactions.txn_type`** is a free-text column; only vehicles set it. `VehicleBody` maps a hardcoded `KNOWN_TXN_TYPES` set to i18n labels.
- **`asset_transactions.settled`** / **`seq`** drive the toggle, chips, schedule numbering, and progress.
- **Commitments** live in `monthly_commitments` (FK `asset_id`, `ON DELETE CASCADE`), managed at `/assets/[id]/commitments` (`CommitmentsManager.tsx`). Currently fetched only for property.

## 3. Target UI — one `AssetBody`

A single component renders every asset type identically. Vertical structure:

1. **Header** (unchanged) — back · asset name · type label · CSV export link.
2. **Balance hero** — branded gradient card (`--hero-grad`), label **"Balance"**, value = `openingBalanceCents + Σ(in) − Σ(out)` via existing `runningBalanceCents`. Same label, same math, every type.
3. **Commitments card** — the existing collapsible card, now shown on **all** types (remove the `type === 'property'` guard). *Its visual redesign is explicitly deferred (see §10).*
4. **Category groups** — transactions grouped by category, rendered as **collapsible sections**:
   - Default **expanded**; each group toggles independently (client-side UI state, not persisted).
   - Group header: chevron · category name (uppercase label) · running subtotal.
   - Groups ordered by category `sort_order`; uncategorised transactions collapse into a single **"Other"** group, always sorted last.
5. **Row anatomy** (uniform): in/out arrow (green `--positive-text` / terracotta `--primary`) · description · date · *optional italic note/remark* (from existing `notes` column, shown only when present) · signed amount (`+`/`−`) · edit pencil linking to the txn edit screen.
6. **Opening-balance line** — muted row at the end of the list when the asset has a non-zero opening balance (now applies to any type, not just property).
7. **Add-txn FAB + bottom sheet** (unchanged shell; form changes in §5).

### Removed from the UI
Next-payment figure, total-paid figure, progress bar, numbered schedule dots, paid/upcoming `StatusChip`, and the "Transferred" settle toggle.

The `settled` and `seq` columns **remain in the database** (no migration to drop them) but are no longer read or written by the assets UI. `toggleTransferred` server action becomes dead and is removed.

## 4. Data model — user-managed categories

Replace free-text `txn_type` with a proper category table so categories can be renamed/deleted in one place.

### New table: `asset_categories`
```sql
create table asset_categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  asset_type text not null check (asset_type in ('property','vehicle','investment','other')),
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index on asset_categories (household_id, asset_type, sort_order);
```
- **Scope: per asset _type_, per household.** All vehicles in a household share the vehicle category set; all properties share the property set; etc.
- **Name:** a single `name` column (not `name_en`/`name_zh`). Rationale: these are user-generated values typed in the user's own language; unlike seeded/system data they are not translated. (Flagged in §11.)

### `asset_transactions` change
- Add `category_id uuid references asset_categories(id) on delete set null`.
- `on delete set null` means deleting a category automatically moves its transactions to "uncategorised" → they render under **"Other"**. This *is* the reassignment behavior; the UI confirmation (§6) is a courtesy on top of it.
- The existing `txn_type` column is **retained but deprecated** (no longer read/written by new code) to avoid a destructive migration. Data is migrated from it (below).

### RLS
Add an `is_member(household_id)` policy set for `asset_categories` in `supabase/migrations/0002_rls.sql`, matching every other household-scoped table. All reads/writes go through the anon client.

### Migration & seed
One new SQL migration (applied manually in the Supabase dashboard, per repo convention — no local migration tooling):
1. Create `asset_categories` + index + RLS.
2. Add `asset_transactions.category_id`.
3. **Backfill:** for each household, for each distinct existing `txn_type` value, insert an `asset_categories` row (`asset_type` = the type of the assets those transactions belong to; `name` = a readable label derived from the current `txnType` i18n label, e.g. `loan` → "Loan"), then set `category_id` on the matching transactions. Transactions with null `txn_type` stay null → "Other".

## 5. Add / Edit transaction form changes

Both `AddTxn.tsx` (bottom sheet) and `EditTxnForm.tsx` replace the free-text **txn type** input with a **category picker**:
- A `<select>`/combobox listing the categories for **this asset's type**, ordered by `sort_order`, plus a blank "Other" option.
- An inline **"+ New category"** affordance that creates a category (for this asset type) on the fly and selects it — persists to `asset_categories` immediately.

Server action signature changes:
- `addAssetTransaction` / `updateAssetTransaction`: `txnType: string | null` → `categoryId: string | null`. Insert/update writes `category_id` instead of `txn_type`. Remove the `settled` argument from `addAssetTransaction`; the `settled` column keeps its DB default of `false` and is never surfaced in the UI.
- `validateTxnInput` / `TxnInput` in `assets-shared.ts`: drop `txnType`/`settled`/`seq` fields no longer collected; add `categoryId`.

## 6. Category management

Model the existing **Commitments manager** (`CommitmentsManager.tsx`): inline add, per-row rename, reorder via up/down buttons, delete.

- **Location:** a dedicated screen keyed by asset type (per-type scope), e.g. `/assets/categories` with a type switcher (Property / Vehicle / Investment / Other), reachable from a "Manage categories" link (in the asset detail near the groups and/or Settings). Placing it under a specific `/assets/[id]/…` route is avoided because categories are shared across all assets of a type, not owned by one asset.
- **Operations:** create, rename, reorder (`sort_order`), delete.
- **Delete flow:** show a **`ConfirmDialog`** (existing component) whose message states that *existing transactions using this category will be moved to "Other"*. On confirm, delete the category row; `on delete set null` reassigns its transactions automatically.
- **New data layer:** `src/lib/data/categories.ts` (server: list/create/rename/reorder/delete, household + type scoped via `getMembership()`) and `src/lib/data/categories-shared.ts` (pure types + any ordering helpers, e.g. reuse `moveItem`). New `actions.ts` with `'use server'` mutations that `revalidatePath` the affected asset screens.

## 7. Data-layer & shared-logic changes

- **`assets-shared.ts`:**
  - `groupByTxnType` → `groupByCategory(txns, categories)`: returns groups ordered by category `sort_order`, each `{ category, rows, subtotalCents }`; null-category rows collapse into a trailing "Other" group. Pure, unit-tested.
  - `assetKeyFigure` collapses to **always balance** (`runningBalanceCents`). `KeyFigure.label` union reduces to `'balance'`. This also standardizes the **asset list** (`AssetRow.tsx`) key figure. Remove now-unused `nextPaymentCents` / `totalSettledOutCents` (and their tests) if nothing else references them.
- **`assets.ts`:** `getAsset` also returns the category list for the asset's type (for grouping + the picker): `{ asset, txns, categories }`. `getAssetsList` key figure uses balance for all.

## 8. i18n

Add bilingual (EN / 中文) keys: category management screen (title, add, rename, delete, empty), the delete confirmation message, the category-picker label and "+ New category", and the **"Other"** group label. Remove keys only used by deleted features (`asset.nextPayment`, `asset.paidUp`, `asset.totalPaid`, `asset.of`, `asset.transferred`, `asset.txnType.*`) once no longer referenced.

## 9. Testing

- **Pure helpers (vitest, colocated):** `groupByCategory` (ordering, subtotals, null→Other trailing, empty), `runningBalanceCents` unchanged, updated `assets-shared.test.ts` for the reduced `assetKeyFigure`.
- **Category ordering** helper (`moveItem` reuse) if a new one is added.
- Manual/verify pass on: add txn with category, inline-create category, rename category (reflects across transactions), delete category → transactions fall to "Other", collapse/expand groups, balance math across in/out + opening balance.

## 10. Suggested build order

1. **Data model** — migration (table, `category_id`, RLS, backfill/seed). Verify in Supabase.
2. **Data layer** — `categories.ts` / `categories-shared.ts`; extend `assets.ts`; `groupByCategory` + tests; collapse `assetKeyFigure`.
3. **Category management** — screen, actions, delete-confirm.
4. **Transaction forms** — category picker + inline create; update `addAssetTransaction`/`updateAssetTransaction`.
5. **Unified `AssetBody`** — build the one component; wire `page.tsx` to it; delete the four old bodies; enable commitments on all types; remove `toggleTransferred`.
6. **List + i18n cleanup** — `AssetRow` balance figure; add/remove i18n keys.

## 11. Out of scope / deferred

- **Commitments card redesign** — the user will rework it separately. This spec only *enables the existing card on all asset types* (guard removal); the visual/behavioral redesign is deferred.
- Dropping the now-unused `settled` / `seq` / `txn_type` columns — left in place; can be cleaned up in a later migration.

## 12. Open considerations (resolve at review)

- **Category name language:** single `name` (chosen) vs bilingual `name_en`/`name_zh`. Single is simpler and matches user-generated content; the downside is a category typed in English shows in English for a 中文 user. Confirm this is acceptable.
- **Enabling commitments on all types now** vs leaving it property-only until the redesign. Spec assumes enable-now (trivial guard removal); easy to defer if preferred.
- **Manage-categories entry point** — Settings link, an affordance on the asset detail, or both.
