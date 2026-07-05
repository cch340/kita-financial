# Excel → Kita Gap Analysis & Roadmap Plan

**Date:** 2026-07-05
**Sources compared:** `tmp/Financial Report 2026.xlsx` (9 sheets) · live Supabase schema + seed data · full app feature inventory (`src/app/(app)/*`, `src/lib/data/*`).

> ⚠️ **Live-data caveat:** `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` is **empty**, and the Supabase MCP server is not authorized in this session. RLS correctly blocks the anon key without a login, so the data picture below comes from the seed files (which were generated from this same Excel). Live rows added through the app since June could not be inspected. This also means some app features that need the service role (member invite, test push, local cron testing) will fail locally until the key is set.

## 1. What the Excel contains vs what the app covers

| Excel sheet | Concept | App coverage | Gap |
|---|---|---|---|
| Joint Fund | Per-member monthly contributions, paid checkbox, carry-forward, cumulative total | **Fund screen — good.** Config + 12×2 matrix, toggle paid, carry-forward chip | Contribution `notes` column exists in DB but isn't shown/editable in UI. No way to edit `joint_fund_config` (expected amounts, carry-forward) in-app. |
| Money breakdown | Budget categories with JC/CH split; house-cost commitment breakdown | **Budget screen — read-only.** Categories + commitments render with split bars | **No add/edit/delete UI** for categories or commitments — they only exist via seed SQL. Per-category "actual spent" is keyword-guessing (`expenseKeysForBudget`), not a real link. |
| Expenses | Dated log: vendor, location, details, amount, running total | **Expenses screen — partial.** Month stepper, day grouping, totals, delete, category chips | Add form captures **no vendor, no location, no date** (today only). **Edit button is inert.** All 81 imported rows have NULL `category` and NULL `paid_by`, so filters/budget links do nothing on real data. |
| CH / JC (Personal) | Monthly income/expense ledger, recurring line items, balance | **Personal screen — good core.** Member switch, month stepper, add entry, balance | **No edit/delete** of entries. No "recurring" support — Excel repeats ~10 identical lines every month; the app makes you retype them (likely why JC's ledger stalled at one month). |
| TreeO | Property account: carry-forward, monthly commitment in, bills out, transferred flag; separate purchase log | **Assets/property — good.** Running balance, in/out txns, Transferred toggle | No edit/delete of transactions. TreeO_purchase table is representable as `out` txns but there's no vendor field on asset txns (description only) — acceptable. |
| Car | Two vehicles: loan, road tax/insurance history, maintenance | **Assets/vehicle — good.** Grouped by txn_type, next-payment hero | No edit/delete. Alza is "CLOSED" in Excel; `assets.status='closed'` exists in schema but no UI to close an asset. |
| AIA Investment | 10-year payment schedule per member, totals | **Assets/investment — good.** Schedule by seq, total paid vs plan | No edit/delete. |
| Expenses grand totals / Joint Fund summary | Year-level rollups | Home shows current month; Fund shows year | **No yearly report/overview** (total spent per category per year, personal balance trend, net position). No export back to Excel/CSV. |
| Sheet5 | Scratch draft | — | Ignore. |

**Cross-cutting gaps:** `name_zh` columns are NULL everywhere (bilingual design unused); "On track" label and greeting on Home are hardcoded; seed files double-insert if re-run (no unique keys) — matters if data is ever re-imported.

## 2. The headline finding

The app's **schema already covers ~95% of the Excel**. What's missing is not data model — it's **workflow**: editing, backdating, managing budget/config rows in-app, and recurring entries. Today the Excel is still "source of truth" for anything the app can't edit, which defeats the project's purpose (mobile-friendly editing).

## 3. Proposed plan (prioritized phases)

### Phase 7 — Full CRUD (kills the need to open Excel)
1. **Edit expense** (wire up the inert swipe-Edit): date picker, vendor, location, category, paid_by, amount, note. Same fields added to the **Add** form (date defaults today, collapsible "more" section to keep the keypad flow fast).
2. **Edit/delete personal ledger entries** and **asset transactions**.
3. **Manage budget categories & monthly commitments** (add/edit/delete/reorder) and **edit joint-fund config** (expected monthly, carry-forward) — probably under Settings or the Budget screen.
4. **Close/reopen assets** (Alza case) + edit asset name/metadata.

### Phase 8 — Data quality & real budget tracking
5. **Categorize existing expenses**: quick triage UI (swipe through uncategorized rows assigning category + paid_by), replacing the keyword-mapping hack with a real `category → budget_category` link (either a `budget_category_id` on expenses or a mapping table).
6. **Backfill `paid_by`** and optionally a settle-up view (who fronted shared money this month).

### Phase 9 — Recurring & monthly flow
7. **"Copy last month"** for personal ledgers (one tap creates this month's recurring lines) or recurring-entry templates.
8. **Auto-post monthly commitments** to TreeO (the RM1,970.58 line) on the 1st via the existing cron, marked unsettled until confirmed.

### Phase 10 — Reports & export
9. **Year overview screen**: spend by category by month, fund summary (the Excel M2 grand-total equivalent), personal balance trend.
10. **CSV/XLSX export** per domain, so Excel becomes an occasional report output instead of a live document.

### Phase 11 — Polish (optional)
11. Fill `name_zh` for categories/commitments; compute "On track" and time-of-day greeting on Home; budget screen month stepper.

### Ops prerequisites (do first, tiny)
- Put the real `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (invite, test push, cron testing, and any data backfill scripts need it).
- Decide whether live DB rows past June match the Excel; if the Excel has newer rows than the DB (or vice versa), do a one-time reconciliation before Phase 8.

## 4. Open questions for the user
1. Is the Excel or the app currently ahead (which one has the newer entries since ~June)?
2. For budget-vs-actual: happy to link expense categories to budget categories explicitly (Phase 8.5), or should budget categories become the expense categories outright?
3. Is settle-up between CH/JC (who owes whom) a wanted feature, or is the joint fund the only sharing mechanism?
4. Priority check: is full-CRUD-first (Phase 7) the right order, or is anything above more urgent?
