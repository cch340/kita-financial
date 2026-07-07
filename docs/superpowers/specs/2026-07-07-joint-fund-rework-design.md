# Joint Fund Rework — Design

**Date:** 2026-07-07
**Status:** Approved, ready for implementation plan
**Scope:** Joint fund only. Budget tables/screens and `joint_fund_config` are intentionally left untouched (redundant, cleaned up later).

## Background

The Excel "Money breakdown" tab's "Joint Fund break down" table was originally imported into `budget_categories`, but it is really the *composition of each member's monthly joint-fund contribution* — its per-person totals (JC 2470, CH 2270) match `joint_fund_config.expected_monthly` exactly. This rework re-homes that concept under the Fund feature as **recurring funds**, and replaces the fund screen's paid/pending 12-month grid with a **records ledger**.

The prior-year carry-forward (RM 1338.53) has already been folded into the January 2026 records (RM 669.26 added to each of CH and JC, with a note), and `joint_fund_config.carry_forward_prev_year_cents` zeroed. See `supabase/seed/seed.sql`.

## Goals

1. A **recurring funds** feature (full CRUD) — reusable per-person contribution templates.
2. Rework the **Fund screen** from a paid/pending grid into a filterable **records ledger** with totals.
3. **Add / edit / delete** individual fund records, with the add amount suggested from the payer's recurring funds.

## Non-goals

- Touching `joint_fund_config`, `budget_categories`, `monthly_commitments`, or the Budget screen.
- Bilingual names for recurring funds (single free-text name is intentional).
- Any paid/pending status workflow (records are simply records).

## Data model

### New table: `recurring_funds`

One row **per member**. The multi-select at creation is a UI convenience that fans out into N independent rows.

| column         | type                    | notes                          |
| -------------- | ----------------------- | ------------------------------ |
| `id`           | uuid pk                 | `gen_random_uuid()`            |
| `household_id` | uuid → households       | cascade delete                 |
| `member_code`  | text `'CH' \| 'JC'`     | check constraint               |
| `name`         | text                    | single free-text, not bilingual|
| `amount_cents` | bigint                  | integer cents                  |
| `remark`       | text null               | optional note                  |
| `sort_order`   | int not null default 0  | display order                  |

RLS: household-scoped via the `is_member(household_id)` helper, matching every other table (add to `0002_rls.sql`).

Editing or deleting a recurring fund **does not affect existing records** — recurring funds only *suggest* an amount at add-time; each saved record stores its own `amount_cents` snapshot.

### Reused table: `joint_fund_contributions` (the fund records ledger)

No schema change. Fields used per record:
- `member_code` — "paid by"
- `period` — first day of the chosen month/year
- `amount_cents` — the (possibly edited) contributed amount
- `notes` — free-text note

`status` is left at its default and ignored by the new UI. Multiple records per member per month are allowed (supports top-ups); there is no unique constraint.

## Screens

### Fund screen (reworked) — `(app)/fund`

Replaces the 12-month paid/pending grid with:

- **Header totals:**
  - *Total contributed this year* — sum of all records whose `period` falls in the current calendar year.
  - *Filtered total* — sum of the records matching the active filters.
- **Filters:** person (default **all**), month (default **all**), year (default **current year**).
- **Records list:** newest first; each row shows month/date, member, amount, note, with **edit** and **delete** affordances.
- **FAB add button:** fixed, same pattern as the expenses screen (`bottom-[100px]`, list padded to clear it).
- **Top-right "Manage recurring funds" button:** navigates to the management screen. Coexists with the existing config icon (config icon left in place, cleaned up later).

### Manage recurring funds screen (new route)

Reached by the top-right button on the Fund screen (separate screen, not inline).

- Lists recurring funds (grouped by / labeled with member), each with **edit** and **delete**.
- **Add form:** `name`, `amount`, `remark`, **members (multi-select CH/JC)** → inserts one `recurring_funds` row per selected member.
- Shows a **per-member monthly total** (this is the value that feeds the add-record suggestion).

### Add / edit / delete record flow

- **Add:** choose **paid by** (single member) → amount **pre-fills** with the sum of that member's recurring funds, and is **editable** (top-up or reduce) → **month + year** (stored as the 1st of the month) → **note**. Saves one `joint_fund_contributions` row.
- **Edit:** same form, prefilled from the record; updates the row.
- **Delete:** removes the row.

All mutations are `'use server'` actions colocated with the screen, following the repo convention: parse `FormData` → call a data-layer function → `revalidatePath(...)` (and `redirect(...)` where appropriate). Errors surface via `?error=` redirect.

## Data layer

Follow the established two-file split:

- **`src/lib/data/recurring-funds.ts`** — server functions (list, create-fanout, update, delete) scoped to `getMembership().householdId` through the anon client (RLS applies).
- **`src/lib/data/recurring-funds-shared.ts`** — pure helpers/types, framework-free, safe for client import and unit tests.
- Fund records: extend `src/lib/data/fund.ts` with list-with-filters, create, update, delete; put pure calculation helpers in `fund-shared.ts`.

### Pure helpers to unit-test (`*-shared.ts`)

- **`suggestedAmountFor(member, recurringFunds)`** — sum of a member's recurring-fund amounts.
- **`totalContributedThisYear(records, year)`** — sum of records in the current year.
- **`filteredTotal(records, filters)`** — sum under the active person/month/year filters.
- **`filterRecords(records, filters)`** — the person/month/year filtering itself (defaults: all person, all month, current year).
- **`fanOutRecurring(input, members)`** — expand one add-form submission into N per-member rows.

## Testing

- Vitest + jsdom, colocated `*.test.ts`, targeting the pure helpers above.
- Server data functions and server actions follow existing patterns; no new test infrastructure.

## Out of scope / cleanup later

- `joint_fund_config` (expected-monthly now superseded by recurring funds; carry-forward already folded into records).
- `budget_categories`, `monthly_commitments`, and the Budget screen.
- The existing fund config icon/editor on the Fund screen (left in place to coexist during transition).
