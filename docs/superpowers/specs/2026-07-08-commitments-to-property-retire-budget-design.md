# Move Monthly Commitments to the TreeO Property & Retire the Budget Module

**Date:** 2026-07-08
**Status:** Approved design — ready for implementation plan

## Context

The budget module has been superseded:

- **Budget categories** are conceptually replaced by **recurring funds** in the fund module (the `recurring_funds` feature already shipped in migration `0006`). The `budget_categories` table and the budget page still exist on `main`, but nothing new depends on them.
- The **monthly commitments** breakdown was never really a "budget" concept — it is the itemized list of recurring monthly obligations for the **TreeO property** (an `assets` row of type `property`). TreeO's transaction ledger already carries a recurring "Monthly Commitment" inflow; the commitments list is the *reference plan* of what that obligation is composed of.

This change relocates monthly commitments onto the property they belong to, then retires the now-empty budget module.

## Decisions (locked)

1. **Retire the budget module fully** — remove the route, nav tab, `budget_categories` table, and the home budget card.
2. **Attach commitments per-asset via an `asset_id` FK** — generic (any property can have a breakdown), TreeO gets the existing rows. RLS stays household-scoped.
3. **Commitments are a reference plan (informational)** — an itemized list + total shown on the property page. They do **not** drive or reconcile against the transaction ledger.
4. **Single free-text name** — drop the bilingual `name_en`/`name_zh`; users type the commitment name in whatever language they choose.
5. **Surface the existing `remark` column** — already in the schema, wire it into the type, queries, create/edit form, and display.
6. **Clean TreeO transaction descriptions** — strip emoji from all TreeO transactions and rename the "Monthly Commitment" inflow to "Installment + Maintenance", in both seed and existing (production) data.

## Data model

### Migration `0007_commitments_to_asset.sql`

Attach commitments to an asset, consolidate the name, retire budget categories:

```sql
-- 1. Attach to asset
alter table monthly_commitments add column asset_id uuid references assets(id) on delete cascade;

update monthly_commitments mc set asset_id = (
  select a.id from assets a
  where a.household_id = mc.household_id and a.type = 'property'
  order by a.sort_order limit 1
) where asset_id is null;

alter table monthly_commitments alter column asset_id set not null;

-- 2. Consolidate bilingual name -> single free-text name
alter table monthly_commitments add column name text;
update monthly_commitments set name = coalesce(nullif(btrim(name_en), ''), name_zh, '');
alter table monthly_commitments alter column name set not null;
alter table monthly_commitments drop column name_en;
alter table monthly_commitments drop column name_zh;

-- 3. Retire budget categories
drop table budget_categories cascade;
```

- `household_id` is **retained** — keeps the existing `is_member(household_id)` RLS policy on `monthly_commitments` unchanged, and keeps the home "upcoming commitments" query working as-is. This mirrors the denormalized `household_id` on `asset_transactions`.
- `remark` already exists (from `0001`); no column change, just start using it.
- `budget_categories` RLS policies drop with the table (`cascade`).

### Migration `0008_treeo_txn_cleanup.sql` (data)

Clean already-applied transaction descriptions for property assets:

```sql
update asset_transactions t
set description = 'Installment + Maintenance'
where t.txn_type = 'monthly_commitment'
  and t.description like 'Monthly Commitment%';

-- strip the known emoji from property transaction descriptions
update asset_transactions t
set description = btrim(replace(replace(replace(t.description, '💵', ''), '⚡', ''), '💧', ''))
where t.description ~ '[💵⚡💧]';
```

## Data layer

Replace the commitments half of `budget.ts` / `budget/actions.ts` with a dedicated domain pair (follows the `<domain>.ts` + `<domain>-shared.ts` split).

**`src/lib/data/commitments-shared.ts`** (pure):
- `CommitmentRow` type: `{ id, name, amountCents, remark: string | null, sortOrder }` (no more `nameEn`/`nameZh`).
- `moveItem` (relocated from the deleted `budget-shared.ts`).

**`src/lib/data/commitments.ts`** (server):
- `getCommitments(assetId)` — display list (`name`, `amountCents`, `remark`, ordered by `sortOrder`).
- `getCommitmentsRaw(assetId)` — manage list.
- `createCommitment({ assetId, name, amountCents, remark })`
- `updateCommitment({ id, name, amountCents, remark })`
- `deleteCommitment(id)`
- `reorderCommitments(orderedIds)`

All scope by `householdId` from `getMembership()` and by `assetId` where relevant; each revalidates `/assets/[id]` (and the manage route). Validation: non-empty `name`, positive integer `amountCents`, `remark` optional/nullable.

**Deletions:** `budget.ts`, `budget-shared.ts`, and their tests. `localizedName` (currently in `budget-shared.ts`) loses its commitment and home consumers — remove it if nothing else imports it; otherwise relocate to a neutral util.

## UI

### Property detail — display
On the property detail page (gated `asset.type === 'property'`), render a **"Monthly commitments"** card under the balance hero and above the transaction ledger. Same visual language as the retired budget commitments card:

- Header row: label + **total** (sum of `amountCents`).
- One row per commitment: `name`, `amountCents`, and `remark` as secondary text when present.
- A **Manage** link → `/assets/[id]/commitments`.

Purely informational; no interaction with the ledger. Shown only when the property has commitment rows (or always for properties with a Manage entry — decide during impl; default: show the card with an empty state + Manage link on properties).

### Manage — `/assets/[id]/commitments`
A `CommitmentsManager` client component extracted from the commitments portion of the current `BudgetManager`:

- Add / edit / delete / reorder (reusing `moveItem`).
- Form fields: **name** (single free-text input — bilingual pair removed), **amount**, **remark** (optional).
- Wired to the `commitments.ts` server actions.

## Retire the budget module

- **Delete** `src/app/(app)/budget/` entirely: `page.tsx`, `actions.ts`, `BudgetBars.tsx`, `manage/`, `loading.tsx`.
- **Nav** (`src/lib/nav/nav-shared.ts`): remove `budget` from `TabId`, `TAB_DEFS`, `TAB_IDS`, and `DEFAULT_LAYOUT`. New default bar: `['home', 'expenses', 'fund', 'assets']` (assets promotes off the "more" overflow into the bar). Update `nav-shared.test.ts` and drop the budget tab icon from `tab-icons.ts`.
- **Home:**
  - Remove the **budget progress card** from `src/app/(app)/page.tsx` (its data source `budget_categories` is being dropped).
  - Remove the now-unused `budget` field wiring in `home.ts` (the `budget_categories` query, `BudgetRow`, `totalCents`) and `budgetPaceKey` in `home-shared.ts` + its test.
  - **Keep** the "upcoming commitments" list — it queries `monthly_commitments` by `household_id` (retained). Update it to select the single `name` column instead of `name_en`/`name_zh` + `localizedName`.
- **i18n** (`dictionaries.ts`): drop `budget.*`, `home.budget`, and budget-pace keys; add `asset.commitments.*` (title, total, manage, add/edit form labels, remark placeholder, empty state) in EN + ZH.

## Seed

- `monthly_commitments` seed rows: replace `name_en`/`name_zh` with single `name`; add `asset_id` = TreeO's id; keep/adjust `remark` values.
- Remove the `budget_categories` seed block.
- TreeO `asset_transactions` seed: strip `💵`/`⚡`/`💧`; rename `Monthly Commitment` → `Installment + Maintenance`.

## Testing

- `commitments-shared.test.ts`: `moveItem` reorder cases (ported from `budget-shared.test.ts`).
- `nav-shared.test.ts`: updated for the budget-less tab set and new default layout.
- `home-shared.test.ts`: remove `budgetPaceKey` cases.
- Manual/`verify`: property page shows the commitments card with total + remark; manage page CRUD + reorder persists and revalidates; budget route is gone (404) and the tab no longer renders; home no longer shows the budget card but still lists upcoming commitments; TreeO ledger shows emoji-free descriptions and the renamed inflow.

## Out of scope

- Repointing the home budget card to any new metric (recurring-funds total, actual monthly spend). The card is removed; a replacement is a future decision.
- Any reconciliation between the commitments plan total and TreeO's actual monthly inflow.
- Surfacing commitments on non-property asset types (data model supports it; UI is property-only for now).
