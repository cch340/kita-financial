# Expense Catalog (user-managed Category / Vendor / Location) + Manage tab & Filter — Design

**Date:** 2026-07-05
**Screen focus:** Expenses (add / edit / list), plus a new **More → Manage** area.
**Status:** design approved in brainstorming; pending spec review → implementation plan.

## 1. Goal

Replace the hardcoded 8-item expense category list with **user-managed lists** for **Category, Vendor, and Location**. Users create/rename/delete/reorder these in a new **Manage** screen (reached via a new **More** tab). Expenses link to them by foreign key. The expenses list gains a **unified Filter sheet** (category + vendor + location, each with an "Other" bucket for unlinked rows). The Add/Edit form is reworked so the **amount stays visible while typing** and vendor/location become **searchable, create-as-you-type dropdowns**.

## 2. Decisions (locked during brainstorming)

| # | Decision | Rationale |
|---|---|---|
| D1 | Managed items are **name-only, single free-text field** (any language; no `_en`/`_zh` split, no icon/color picker now). Auto-assign a neutral tile in the list. | User rarely switches language; keeps model + UI simple. |
| D2 | **Category starts empty**; **Vendors + Locations seeded from the Excel** (`tmp/Financial Report 2026.xlsx`). | Excel expenses have no category; vendor/location values exist there. |
| D3 | Existing expense rows: **migrate** `vendor`/`location` text → new records + set FK; **category left null**. | Preserve real vendor/location data; no category data to preserve. |
| D4 | Storage = **FK link**: `expenses.category_id / vendor_id / location_id`, `ON DELETE SET NULL`. Old text columns **dropped**. | Rename propagates instantly; clean "Other = id is null"; single source of truth. |
| D5 | Delete-in-use = **warn with count, then unlink** ("Used by N expenses — delete anyway?" → FK set null → falls to "Other"). | Non-destructive to amounts, but guarded against accidents. |
| D6 | Case-insensitive **uniqueness** enforced by DB unique index on `(household_id, lower(name))` **and** blocked in the create UI. | Prevents "Aeon"/"aeon" duplicates. |
| D7 | **Manage surface** = new **More** tab. 5th tab `Assets` → `More`; `/more` lists **Assets** + **Manage**; `/manage` has three sections. | 5 tabs are full on mobile; "More" groups secondary areas. |
| D8 | Data layer = **thin per-kind modules** (`categories.ts`, `vendors.ts`, `locations.ts`) over a shared pure `catalog-shared.ts`, **not** one generic keyed module. | User anticipates category diverging (e.g. a future `color`); the seam must let category grow columns without touching vendor/location. |
| D9 | Filtering = **one unified Filter sheet** (category + vendor + location together, each with "Other"), combined as **AND**. Replaces the always-on category chip row on the list. | Cleaner header; one place for all three dimensions. |
| D10 | Add/Edit form: **category chips are select-only** (no inline "+ New" — categories are created in Manage). **Vendor/Location** get inline create via the combobox search field. | Inline create was only ever wanted for vendor/location. |
| D11 | Add/Edit form: **amount + who-paid move to a bottom cluster with the numpad** so they stay visible on short screens. | Current top-anchored amount scrolls off. |

## 3. Data model — migration `supabase/migrations/0003_expense_catalog.sql`

Three household-scoped tables, identical shape, RLS via existing `is_member()`:

```sql
create table expense_categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create unique index on expense_categories (household_id, lower(name));
-- vendors  : same columns + unique index on (household_id, lower(name))
-- locations: same columns + unique index on (household_id, lower(name))
```

RLS (mirror `0002_rls.sql` pattern) — enable RLS + policies using `is_member(household_id)` for select/insert/update/delete on all three tables.

Link columns + drop old text:

```sql
alter table expenses
  add column category_id uuid references expense_categories(id) on delete set null,
  add column vendor_id   uuid references vendors(id)            on delete set null,
  add column location_id uuid references locations(id)          on delete set null;
create index on expenses (household_id, category_id);
-- (vendor_id / location_id indexes optional; small table)
```

**Backfill (same migration, before dropping columns):**

```sql
-- Vendors: distinct non-blank vendor text per household
insert into vendors (household_id, name)
  select distinct household_id, trim(vendor)
  from expenses
  where vendor is not null and trim(vendor) <> '' and trim(vendor) <> '-';
update expenses e set vendor_id = v.id
  from vendors v
  where v.household_id = e.household_id and lower(v.name) = lower(trim(e.vendor));

-- Locations: same, treating '-' as no location
insert into locations (household_id, name)
  select distinct household_id, trim(location)
  from expenses
  where location is not null and trim(location) <> '' and trim(location) <> '-';
update expenses e set location_id = l.id
  from locations l
  where l.household_id = e.household_id and lower(l.name) = lower(trim(e.location));

-- Category: intentionally NOT seeded (Excel has none)
```

Then drop the replaced columns (Excel is the backup):

```sql
alter table expenses drop column vendor, drop column location, drop column category;
-- `details` (the note) stays.
```

Expected seed result for the live household: Vendors ≈ {Aeon, Eco, Jaya Grocer, Lotus, Retail, Shopee, Sunshine, Taobao}; Locations ≈ {Bayana, Billion, Gurney Plaza, Ipoh Parade, Queensbay, Seberang Jaya, Sunshine Square, Sunway Carnival}; Categories = ∅.

**Deployment ordering:** because columns are dropped, the app code that reads `*_id` must be deployed together with (or immediately after) running this migration. Coordinate as one release; brief downtime acceptable for a 2-person app.

## 4. Data layer — `src/lib/data/`

### 4.1 `catalog-shared.ts` (pure, no supabase / no `next/headers`)
The genuinely kind-invariant logic, unit-tested once:
- `type CatalogItem = { id: string; name: string; sort_order: number }`
- `normalizeName(raw: string): string` — trim + collapse inner whitespace.
- `findCaseInsensitiveDuplicate(name: string, existing: CatalogItem[]): CatalogItem | null`.
- `nextSortOrder(existing: CatalogItem[]): number`.
- `reorderIds(currentIds: string[], fromIndex, toIndex): string[]` (pure array move → the new order the server persists).

### 4.2 Thin per-kind modules — `categories.ts`, `vendors.ts`, `locations.ts` (server)
Each ~15–25 lines. All import `catalog-shared` + `createClient` + `getMembership`. Each declares only its **table name** and **column list** (today: `name, sort_order`). Functions per module:
- `list<Kind>()` → `CatalogItem[]` scoped to household, ordered by `sort_order`.
- `create<Kind>(name)` → checks case-insensitive dup (returns existing id or `{ error: 'duplicate' }`), else insert with `nextSortOrder`.
- `rename<Kind>(id, name)` → dup check (excluding self), update.
- `delete<Kind>(id)` → delete (FK `SET NULL` unlinks expenses automatically).
- `reorder<Kind>(orderedIds)` → persist `sort_order`.
- `countExpensesUsing<Kind>(id)` → count expenses with matching `*_id` (for the delete warning).

> **Divergence path (documented, not built now):** to later add `color` to categories only — add a `color` column to `expense_categories`, add `color` to `categories.ts`'s column list + `createCategory/renameCategory` signatures, render a swatch in the category Manage row. `vendors.ts` / `locations.ts` are untouched; `catalog-shared.ts` is untouched.

### 4.3 Consumer updates
- **`expenses-shared.ts`**: `ExpenseInput` replaces `vendor/location/category` strings with `categoryId/vendorId/locationId: string | null`; `parseExpenseForm` reads the id form fields; validation unchanged otherwise.
- **`expenses.ts`**: `COLS` selects the FK ids + joined names (`expense_categories(name)`, `vendors(name)`, `locations(name)`); `addExpense`/`updateExpense` write `*_id`; `listExpenses` returns the joined names for display. `ExpenseRow` type in `types.ts` updated accordingly (keep `category_name` / `vendor_name` / `location_name` fields for the list UI).
- **Triage** (`triage-shared.ts`, `TriageView.tsx`, triage `actions.ts`): assign `category_id` (+ `paid_by`); "needs sorting" = `category_id is null OR paid_by is null`. The triage category picker uses the household category list (may be empty → user creates categories in Manage first).
- **Report** (`report-shared.ts`, `ReportView.tsx`, `report/export/route.ts`): group by joined **category name**; category order from catalog `sort_order`; `null` → "Uncategorized" bucket. Remove the hardcoded `CATEGORY_ORDER`/`CATEGORIES` import.
- **Budget** (`budget.ts`, `budget/actions.ts`, tests): **drop** `expenseKeysForBudget` and the keyword-based actual-spend computation (relied on the fixed keys being removed; budget/expense categories are decoupled per prior decision). Budget shows planned values only. Note in code that actual-vs-budget is intentionally out of scope here.
- **Delete** `src/lib/categories.ts` and its tests; remove all imports.
- **ExpensesView.tsx**: row tile no longer keyed off hardcoded icon/tint — use a neutral `IconTile` (e.g. `Tag`) with a stable tint; title/subtitle use joined names.

## 5. Navigation & Manage screens

- **`BottomTabBar.tsx`**: replace the `Assets` tab entry with **More** (`href: '/more'`, `key: 'nav.more'`, icon `LayoutGrid` or `Menu`). Tabs: Home · Expenses · Fund · Budget · More. Active state for `/more` also covers `/assets` and `/manage` (so the tab highlights on those sub-screens).
- **`/more` (`(app)/more/page.tsx`)**: simple menu list linking to **Assets** (`/assets`) and **Manage** (`/manage`). Extensible for future entries. Server component.
- **`/manage` (`(app)/manage/`)**: three sections — Categories, Vendors, Locations. Server component loads the three lists; a client `ManageSection` renders each. Per row: **rename** (inline edit), **delete** (confirm dialog "Used by N expenses — delete anyway?" using `countExpensesUsing*`), **reorder** (drag handle; persists via `reorder*`). Top **add** input with case-insensitive block (shows an inline "already exists" message). Server actions in `(app)/manage/actions.ts` wrapping the data-layer functions + `revalidatePath('/manage')` and `/expenses`.
  - `ManageSection` is **name-only now** but written so a category-specific variant can render an extra field (color) later without vendor/location inheriting it.

## 6. Add / Edit form rework

Shared between `AddExpenseForm.tsx` and `EditExpenseForm.tsx`. Both load the household category/vendor/location lists (passed as props from the server page).

- **Category chips** — a **2-row-tall, horizontally-scrolling** strip: `grid grid-flow-col grid-rows-2 gap-2 overflow-x-auto`. Chips are **select-only** (single-select, tap again to clear). **No "+ New" chip.** If the list is empty, show a hint linking to Manage.
- **Vendor & Location** — new reusable **`src/components/ui/Combobox.tsx`**:
  - Trigger shows current selection (or placeholder).
  - Opens a panel with a **search text input on top**, filtered list below.
  - When the typed value has **no case-insensitive exact match**, show a **"Create '<typed>'"** row; selecting it calls the create server action, which blocks duplicates (defense-in-depth with the filter). On success the new item is selected.
  - Selecting an item sets the hidden `vendorId` / `locationId`.
  - Reused for both vendor and location; parameterized by list + create action + labels.
- **Layout (amount + who-paid below numpad):** three regions in the fixed full-screen sheet:
  1. **Header** (back / title / close) — unchanged.
  2. **Scrollable middle** (`flex-1 overflow-y-auto`): category chips (2-row scroll), note, vendor combobox, location combobox, date (and the existing "more" affordance if kept).
  3. **Bottom cluster** (not scrolled): **numpad** → **amount** (large, with the blinking cursor) → **who-paid** (CH / JC) → **Save**.

```
┌───────────────────────────┐
│ ‹      Add Expense      ×  │  header
├───────────────────────────┤
│ [Food][Groceries] …   ↔   │  ┐ scrollable middle
│ [Dining][Transport]       │  │  (category chips: 2 rows,
│ note ______________       │  │   scroll-x; then note,
│ Vendor:   [ Aeon      ▾]  │  │   vendor, location, date)
│ Location: [ Gurney    ▾]  │  ┘
├───────────────────────────┤
│  1   2   3                │  ┐ bottom cluster
│  4   5   6                │  │  (always visible)
│  7   8   9                │  │
│  00  0   ⌫                │  │  numpad
│      RM 128.00            │  │  amount (below numpad)
│   Who paid:  [CH] [JC]    │  │  who-paid
│  [        Save        ]   │  ┘
└───────────────────────────┘
```

- **Add** and **Edit** both use the keypad-driven cents entry (`pushDigit`/`pushDoubleZero`/`backspace`), with the same bottom cluster (numpad → amount → who-paid → Save). Edit seeds the keypad `cents` state from `row.amount_cents` and drops its old decimal text input, so the two forms share one interaction. Consider extracting the shared keypad + bottom cluster into a small component reused by both.

## 7. Expenses list — unified Filter sheet

- Remove the always-on category chip row from `ExpensesView.tsx`.
- Add a **Filter** button in the header (badge/dot when any filter active).
- **`FilterSheet`** (client, bottom sheet): three grouped pickers — **Category, Vendor, Location** — each a scrollable chip/list group with an **"Other"** option (matches `*_id is null`) and a clear-all. Selections combine with **AND**. "Apply" filters the in-memory `rows` client-side (list is already month-scoped and loaded), consistent with today's client filtering.
- Empty-state and per-day grouping unchanged.

## 8. i18n

Add keys to `src/i18n` dictionaries (EN + ZH): `nav.more`, `more.assets`, `more.manage`, `manage.categories`, `manage.vendors`, `manage.locations`, `manage.add`, `manage.rename`, `manage.delete`, `manage.deleteInUse` ("Used by {n} expenses — delete anyway?"), `manage.duplicate` ("Already exists"), `manage.empty`, `expenses.filter`, `filter.other`, `filter.apply`, `filter.clear`, `add.selectVendor`, `add.selectLocation`, `combobox.create` ("Create \"{name}\""), `combobox.search`. Reuse existing `add.*` where possible.

## 9. Local seed

Update `supabase/seed/generate_seed.py` (and regenerate `seed.sql`) to: create the three tables' seed rows from the Excel's distinct vendor/location values, and set `vendor_id`/`location_id` on seeded expenses instead of the dropped text columns. Categories seed empty. Keep seed idempotent-friendly per existing conventions.

## 10. Testing (vitest, colocated)

- `catalog-shared.test.ts`: `normalizeName`, `findCaseInsensitiveDuplicate` (case/whitespace variants), `reorderIds`, `nextSortOrder`.
- `expenses-shared.test.ts`: `parseExpenseForm` reads the new id fields; validation unchanged.
- Update `report-shared.test.ts`, `triage-shared.test.ts`, `budget.test.ts` for the new grouping / removed keyword hack.
- Combobox create-vs-select and dup-block covered by shared-logic tests; UI wiring verified manually via `/run`.

## 11. Build sequence (for the implementation plan)

1. **Migration + backfill + drop columns** (`0003_expense_catalog.sql`) and RLS; update `types.ts`.
2. **Data layer**: `catalog-shared.ts` + `categories.ts`/`vendors.ts`/`locations.ts`; update `expenses.ts`/`expenses-shared.ts`; delete `categories.ts` (hardcoded); fix triage/report/budget consumers + tests.
3. **Navigation + Manage**: tab-bar change, `/more`, `/manage` (+ `ManageSection`, actions).
4. **Add/Edit form**: `Combobox`, category 2-row scroll strip (select-only), amount/who-paid bottom cluster.
5. **Filter sheet** on the expenses list.
6. **Local seed** regen; final `npm run lint` + `npm test` + manual `/run` pass.

## 12. Deferred / future (recorded, out of scope)

- Move **Budget's** existing "manage" (categories & commitments) into the Manage screen.
- Optional **color/icon** on categories (design seam preserved in §4.2).
- Actual-vs-budget spend link (dropped here; would be a real `category_id` → budget mapping, not the old keyword hack).
- Reorder polish (drag ergonomics) if the simple handle proves fiddly.

## 13. Risks / notes

- **Destructive migration** (drops 3 columns). Mitigation: Excel backup, verify backfill counts before drop, deploy code + migration together.
- **Empty category list initially** → every expense shows under "Uncategorized"/"Other" and triage flags all rows until the user creates categories. Expected and acceptable.
- **Budget actual-spend disappears** — intended per D-decisions; call out in release notes so it isn't read as a regression.
