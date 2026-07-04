# Family Finance Tracker — Design & System Spec

**Date:** 2026-07-04
**Author:** CH (with Claude)
**Status:** Approved design → ready for implementation planning
**Purpose:** Replace a hard-to-use-on-mobile Google Sheet ("Financial Report 2026.xlsx") with a
mobile-first, installable web app that a couple (CH + JC) share to track their household finances.

---

## 1. Goals & Non-Goals

### Goals
- **Mobile-first**: fast, thumb-friendly daily use — especially logging expenses.
- **Shared**: both spouses see the same data live; changes sync instantly.
- **Complete**: cover everything the current sheet does (see §4 scope).
- **Reminders**: push notifications for monthly commitments and yearly big payments.
- **Bilingual**: English + 中文, user-selectable.
- **Installable (PWA)**: home-screen icon, offline-tolerant, native-feeling.

### Non-Goals (v1)
- No bank/API auto-import of transactions (manual entry, seeded from the sheet).
- No multi-currency (everything is RM / MYR).
- No more than one household per user, no more than ~2–3 members.
- No complex reporting/forecasting beyond budget-vs-actual and running totals.

---

## 2. Users & Sharing Model ("Household")

Two users today: **CH** (Chong Choon Hong) and **JC** (Teoh Zi Ying). Currency **RM**. They have a
baby, **Leo (泽泽)**, referenced across the budget/expenses.

**Core concept:** data belongs to a shared **Household**, not to an individual.

```
   CH ──┐
        ├──> Household ──> ALL financial data (household_id on every row)
   JC ──┘
```

- Each person logs in with their own account (identity + who-did-what).
- All data rows carry a `household_id`; Postgres **Row Level Security (RLS)** ensures a user only
  ever reads/writes rows for a household they belong to.
- Adding a spouse = inviting their email into the household.
- Login identity is used to: tag `paid_by` on expenses, label personal ledgers (CH vs JC), and
  personalize/deliver reminders per user.

---

## 3. Architecture

```
┌──────────────────────────────────────────────────────────┐
│  PWA (installable) — Next.js (App Router) + Tailwind      │
│  + shadcn/ui components                                   │
│  Service worker: offline cache + Web Push receiver        │
│  i18n: next-intl (or equivalent), en + zh                 │
└───────────────┬──────────────────────────────────────────┘
                │ HTTPS (Supabase JS client)
┌───────────────▼──────────────────────────────────────────┐
│  Supabase                                                 │
│  • Postgres (all tables, household-scoped via RLS)        │
│  • Auth (email + password)                                │
│  • Edge Function + pg_cron: daily reminder scan           │
│  • Web Push (VAPID keys) → sends notifications            │
└──────────────────────────────────────────────────────────┘

Hosting: Vercel (frontend) + Supabase (backend). Both free-tier sufficient for 2 users.
```

**Rationale:** standard modern PWA stack; free at this scale; Supabase bundles auth + DB +
scheduled jobs + push; Claude Design output (React/Tailwind/shadcn) drops directly onto this.

---

## 4. Scope (v1) — mapped from the spreadsheet

All of the following are **in v1**:

| Sheet | Feature area | Notes |
|---|---|---|
| Joint Fund | Joint Fund tracking | per-person monthly contribution, paid/unpaid, running total, carry-forward from 2025 |
| Money breakdown | Budget | category split (JC/CH), monthly commitments (house, utilities, internet) |
| Expenses (+ Sheet5) | Daily expense log | **Sheet5 is a duplicate → merged into Expenses on import** |
| CH / JC (Personal) | Personal ledgers | per-person monthly income vs. expense + balance |
| TreeO, Car, AIA Investment | **Assets module** (generic) | TreeO = condo (property), Car = vehicles, AIA = investment — all modelled as *assets with transactions*; see §5.1. New asset types need no schema/UI change. |

---

## 5. Data Model

Sharing/identity layer:
- **households** — `id`, `name`, `base_currency` (default `MYR`), `created_at`.
- **profiles** — `id` (= auth user id), `display_name`, `email`, `language` (`en` | `zh`, default `en`), `avatar_color`.
- **household_members** — `household_id`, `user_id`, `role` (`owner` | `member`), `member_code` (`CH`|`JC`).

Finance tables (all carry `household_id`):
- **joint_fund_config** — per member: `member_code`, `expected_monthly_amount`, `carry_forward_prev_year`.
- **joint_fund_contributions** — `member_code`, `period` (month), `amount`, `status` (`paid`|`pending`), `notes`.
- **budget_categories** — `name_en`, `name_zh`, `jc_amount`, `ch_amount`, `total`, `remark`, `sort_order`.
- **monthly_commitments** — `name_en`, `name_zh`, `amount`, `remark` (house installment, maintenance, internet, utilities…).
- **expenses** — `date`, `vendor`, `location`, `details`, `category` (nullable), `amount`, `paid_by` (`member_code`), `created_by`.
- **ledger_entries** — `owner_member_code`, `period` (month), `entry_type` (`income`|`expense`), `description`, `amount`, `remark`.
Assets (generic module — see §5.1):
- **assets** — the generic "thing we own with money-flows attached".
- **asset_transactions** — the money-flows for each asset.

Notifications:
- **push_subscriptions** — `user_id`, `endpoint`, `p256dh`, `auth` (Web Push keys).
- **reminder_settings** — `user_id`, `reminder_type` (`monthly_commitment` | `yearly_big_payment`), `enabled` (default `true`).

### 5.1 Assets module (generic — replaces bespoke TreeO/Car/AIA tables)

**Motivation:** TreeO (condominium = a *property*), Car (*vehicles*), and AIA (*investment*) are the
same shape — an owned asset with a stream of money-flows. Modelling each separately means every
future "thing we track" needs new tables and screens (the exact pain the sheet has today). One
generic pair of tables covers all present cases and any future asset with **no schema or UI change**.

- **assets**
  - `id`, `household_id`
  - `type` — `property` | `vehicle` | `investment` | `other`
  - `name` — e.g. `"TreeO"` (condo), `"Myvi PQC 9059"`, `"Alza PNM 9059"`, `"AIA — CH"`, `"AIA — JC"`
  - `owner_member_code` — nullable; shared for condo/car, set (CH/JC) for per-person investments
  - `status` — `active` | `closed` (e.g. a paid-off car loan shows CLOSED)
  - `opening_balance` — nullable; carry-forward seed for running-balance assets (e.g. TreeO 2025 carry-forward)
  - `metadata` — jsonb for type-specific fields: property `{unit}`, vehicle `{plate}`, investment `{total_terms, policy_no}`
  - `sort_order`, `created_at`

- **asset_transactions**
  - `id`, `asset_id`, `household_id`
  - `date`, `description`, `amount`
  - `direction` — `in` (contribution/into the asset) | `out` (payment/bill)
  - `txn_type` — free-ish enum used for grouping & rendering, e.g.
    `monthly_commitment` | `bill` | `payment_out` | `loan` | `road_tax_insurance` | `maintenance` |
    `loan_payback` | `scheduled_payment`
  - `settled` — bool (maps the sheet's "Is money transferred?" / paid flag)
  - `seq` — nullable ordinal for scheduled assets (AIA payment #1..#10)
  - `notes`, `created_by`, `created_at`

**How the three current assets map:**
- **TreeO (property)** — `opening_balance` = 2025 carry-forward; transactions are `monthly_commitment`
  (in) and `bill`/`payment_out` (out) with `settled` = transferred?; running balance computed in app.
- **Car (vehicle)** — one `assets` row per car; transactions grouped by `txn_type`
  (loan / road_tax_insurance / maintenance / loan_payback); closed loans → `status=closed`.
- **AIA (investment)** — one `assets` row per person; transactions are `scheduled_payment` with `seq`,
  `settled` marking paid vs. upcoming; total = sum.

Adding a future asset (second property, stock account, fixed deposit…) = insert one `assets` row +
its transactions. The Asset detail screen renders by `type`.

**Seeding:** the existing xlsx is parsed once and inserted into these tables (data already parsed
and available). Bilingual category/commitment names filled where known; the rest default to the
existing (English/mixed) text, editable later.

---

## 6. Screens (mobile-first)

Bottom tab bar: **Home · Expenses · Fund · Budget · Assets**
(Settings reached via a gear icon in the Home header — it's not a daily-use tab. Personal ledgers
reached from Home; see below.)

1. **Home / Dashboard** — this-month snapshot: Joint Fund status (paid? total), budget vs. actual,
   upcoming reminders, prominent **＋ Add Expense** action; header gear → Settings; entry point to
   **Personal** ledgers.
2. **Expenses** — fast add flow (amount → category → who paid → note); scrollable + filterable list;
   monthly totals; edit/delete.
3. **Joint Fund** — both members' contributions, tap-to-mark-paid, running total + carry-forward.
4. **Budget** — category splits (JC/CH) and monthly commitments; budget-vs-actual bars.
5. **Assets** — generic asset module (§5.1). **Assets list** grouped by type
   (Property · Vehicles · Investments · Other), each card showing name + key figure (running balance /
   next payment / total paid). **Asset detail** adapts to `type`:
   - *property* (TreeO condo) → running balance + transactions with a "transferred?" toggle
   - *vehicle* (Car) → payments grouped by type (loan / road tax+insurance / maintenance)
   - *investment* (AIA) → yearly payment schedule/timeline, paid vs. upcoming, totals
   Add-asset and add-transaction flows.
6. **Personal** (accessed from Home) — CH & JC ledgers; income vs. expense; monthly balance; add entry.
7. **Settings** (gear from Home) — household members & invite; **language toggle (EN / 中文)**;
   notification toggles; install-to-home-screen prompt; sign out.

---

## 7. Notifications

- A **daily scheduled job** (Supabase pg_cron → Edge Function) scans for:
  - **Monthly commitment due** — on/before the 1st of each month (Joint Fund contribution, TreeO
    monthly commitment, monthly commitments list).
  - **Yearly big payment** — AIA payment & car road-tax/insurance renewal, ~2 weeks ahead.
- Sends **Web Push** to each household member **whose toggle for that type is on** (default on).
- **iOS caveat:** web push requires the app be **Added to Home Screen** first (PWA). The UI shows an
  install prompt/instructions on iOS. Android works without install.

---

## 8. Internationalization

- Two locales: **English (`en`)** and **中文 (`zh`)**, chosen per user in Settings (`profiles.language`).
- All UI strings live in translation files; category/commitment names carry `_en` and `_zh` columns.
- Font stack must render CJK cleanly; layouts must tolerate text-length differences between locales.

---

## 9. Security & Privacy

- Supabase Auth (email + password); sessions persisted for stay-logged-in.
- **RLS on every table** keyed on `household_id` via `household_members` — no cross-household leakage.
- Financial data is sensitive: HTTPS only; no third-party analytics on financial values.

---

## 10. Out-of-session build plan (after Claude Design returns UI)

1. Supabase project: schema + RLS policies + auth.
2. Import script: xlsx → seed tables.
3. Next.js PWA shell: routing, auth, i18n, service worker.
4. Drop in Claude Design's screens; wire to Supabase.
5. Notifications: pg_cron job + Edge Function + Web Push.
6. Deploy to Vercel; install on both phones; verify sync + push.

---

## 11. Open items (non-blocking)
- Exact bilingual translations for existing category/commitment text (fill during build).
- Whether personal ledgers should auto-derive some entries from Joint Fund/expenses (v2).

---

# APPENDIX A — UI Brief for Claude Design (copy-paste this)

> Paste the block below into Claude Design. It is self-contained.

---

**Project:** "Family Finance" — a mobile-first PWA for a married couple (Malaysia, currency **RM**)
to track shared household finances. Replaces a clunky Google Sheet. Two primary users: **CH** and
**JC**, plus references to their baby **Leo (泽泽)**.

**You have full creative freedom on visual direction.** No brand or color constraints — aim for a
warm, trustworthy, calm *family-finance* feel (not a cold corporate dashboard). It must look and
feel great one-handed on a phone.

**Hard constraints:**
- **Mobile-first**, thumb-reachable. Bottom tab bar. Large tap targets. Optimized for iPhone + Android.
- **Bilingual EN / 中文** — provide a language toggle; design so layouts tolerate both (CJK glyphs,
  text-length changes). Show representative Chinese text in mockups.
- **PWA** — include an "Add to Home Screen / Install" prompt UI (needed for iOS push notifications).
- **Component kit:** React + Tailwind + shadcn/ui (so output integrates with a Next.js app).
- All monetary values shown as **RM 1,234.56**.

**Bottom-tab navigation:** Home · Expenses · Fund · Budget · Assets
(Settings via a gear icon in the Home header; Personal ledgers opened from Home.)

**Screens to design:**

1. **Home / Dashboard** — this-month snapshot cards: Joint Fund status (contributed vs. expected,
   paid/pending), budget vs. actual spending, list of upcoming reminders, and a prominent
   **＋ Add Expense** button (FAB or hero action). A header **gear icon → Settings**, and an entry
   point to **Personal** ledgers.

2. **Expenses** — the daily-driver. A fast **Add Expense** flow: amount (big numeric keypad first) →
   category (chips) → who paid (CH / JC toggle) → optional note/vendor/date. Plus a scrollable,
   filterable transaction list grouped by date, with running monthly total, and edit/delete (swipe).

3. **Joint Fund** — two members' monthly contributions side by side; each month row shows amount +
   **paid/pending** with a tap-to-mark-paid control; running total and a "carry-forward from last
   year" figure. A progress feel toward the yearly total.

4. **Budget** — from a "money breakdown": categories split between JC and CH (e.g. House, Food,
   Emergency fund, Leo insurance, Leo food+diapers). Show each category's JC/CH split and total, plus
   a **budget-vs-actual bar**. Separate section for fixed **monthly commitments** (house installment,
   utilities, internet).

5. **Assets** — a **generic asset module**. The household owns assets of different *types*, each with
   a stream of money-flows. Design two views:
   - **Assets list** — cards grouped by type: **Property · Vehicles · Investments · Other**. Each card
     shows the asset name + one key figure (running balance, or next payment, or total paid).
   - **Asset detail** — a header (name, type, key metric) + a transaction list + add-transaction. The
     body **renders differently per type**, so design these three variants:
     - **Property** (e.g. "TreeO", a condominium) → a **running balance** with in/out transactions,
       each having a **"transferred?" toggle** (monthly commitments in, bills/payments out).
     - **Vehicle** (e.g. "Myvi", "Alza") → payment history **grouped by type**: loan, road tax +
       insurance, maintenance. Some items can be marked CLOSED.
     - **Investment** (e.g. "AIA — CH", "AIA — JC") → a **yearly payment schedule/timeline** of ~10
       numbered payments, paid vs. upcoming, with a total.
   Also design an **"Add asset"** entry (choose type → name → type-specific fields).
   *Design goal: the UI should feel uniform across asset types so a brand-new asset type slots in
   naturally.*

6. **Personal** (opened from Home) — two personal ledgers (CH, JC). Per month: **Income** (salary,
   rental) vs. **Expenses** (subscriptions, insurance, petrol, contributions…) and a resulting
   **Balance**. Switch between CH and JC. Add-entry flow.

7. **Settings** (gear icon from Home) — household members + invite-by-email; **language toggle
   (EN / 中文)**; **notification toggles** (Monthly commitments, Yearly big payments — default ON);
   install-to-home-screen prompt; sign out.

**Notifications UX:** design the notification-settings section and an example push/reminder card
(e.g. "Joint Fund contribution due — RM 2,270" / "AIA payment coming up in 2 weeks").

**Deliverable:** polished, responsive React + Tailwind + shadcn/ui screens for all of the above,
mobile-first, with light/dark handled gracefully, and Chinese text shown in at least a couple of
screens to prove the bilingual layout.
