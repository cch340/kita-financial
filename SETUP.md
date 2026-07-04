# Kita — Setup Guide (Phase 1)

Phase 1 (foundation) is code-complete. This guide walks you through the **manual
cloud steps** only *you* can do (they need your Supabase account), then verifies
everything works end-to-end. Budget ~15–20 minutes.

You'll do this once. After it, you and your wife can log in on your phones and see
your real data.

---

## Prerequisites
- The repo cloned locally, on the `phase-1-foundation` branch (or `main` after merge).
- `npm install` already run (done during the build).
- Your spreadsheet at `tmp/Financial Report 2026.xlsx` (used only if you re-run the seed generator; the generated `supabase/seed/seed.sql` is already committed).

---

## Step 1 — Create the Supabase project
1. Go to https://supabase.com → **New project**.
2. Name it `kita`. Choose a strong database password (save it). Region: **Southeast Asia (Singapore)** — closest to Malaysia.
3. Wait for it to finish provisioning (~2 min).
4. Go to **Project Settings → API** and copy these three values (you'll need them in Step 6):
   - **Project URL**
   - **anon public** key
   - **service_role** key (secret — never commit it)

## Step 2 — Apply the database schema
1. In the Supabase dashboard, open **SQL Editor → New query**.
2. Open the repo file `supabase/migrations/0001_schema.sql`, copy its entire contents, paste, and click **Run**.
   - Expected: *"Success. No rows returned."*
3. New query → paste the entire contents of `supabase/migrations/0002_rls.sql` → **Run**.
   - Expected: *Success.*
4. Sanity check — new query, run:
   ```sql
   select count(*) as tables from information_schema.tables where table_schema='public';
   ```
   Expected: **13**.

## Step 3 — Create your two login accounts
1. Dashboard → **Authentication → Users → Add user**.
2. Create **CH**: email `cch340@gmail.com`, set a password, and tick **Auto Confirm User**.
3. Create **JC**: your wife's email, a password, **Auto Confirm User**.
4. Click each user and copy its **User UID** (a UUID). Note which is CH and which is JC — you need both next.

## Step 4 — Create the profile rows
In **SQL Editor**, run this (replace the two UUIDs and JC's email):
```sql
insert into profiles (id, display_name, email, language, avatar_color) values
 ('PASTE-CH-UUID', 'CH', 'cch340@gmail.com', 'en', 'peach'),
 ('PASTE-JC-UUID', 'JC', 'PASTE-JC-EMAIL',   'en', 'blue');
```
Expected: *Success. 2 rows.*

## Step 5 — Seed your data
The generated seed uses `:CH_UID` / `:JC_UID` placeholders. Substitute your real UUIDs, then apply.

**Option A — locally (recommended), produces the file to paste:**
```bash
cd /Users/chongchoonhong/Documents/workspace/financial-tracker-webapp
sed -e "s/:CH_UID/'PASTE-CH-UUID'/g" -e "s/:JC_UID/'PASTE-JC-UUID'/g" \
  supabase/seed/seed.sql > supabase/seed/seed.applied.sql
```
Then open `supabase/seed/seed.applied.sql`, copy all of it, paste into a new **SQL Editor** query, and **Run**.
(`seed.applied.sql` is gitignored — it contains your real user IDs, so it won't be committed.)

**Verify the seed:**
```sql
select
  (select count(*) from expenses) as expenses,
  (select count(*) from assets) as assets,
  (select count(*) from joint_fund_contributions) as contribs;
```
Expected: **expenses 81, assets 5, contribs 24**.

> Note: 19 expenses in your sheet had no date; each inherited the date of the row
> above it (same period). You can edit any of these in the app later.

## Step 6 — Point the app at your project
1. In the repo, copy the example env file:
   ```bash
   cp .env.example .env.local
   ```
2. Edit `.env.local` and fill in the three values from Step 1:
   ```
   NEXT_PUBLIC_SUPABASE_URL=<Project URL>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
   SUPABASE_SERVICE_ROLE_KEY=<service_role key>
   ```
   (`.env.local` is gitignored — safe.)

## Step 7 — Run and verify end-to-end
```bash
npm run dev
```
Open http://localhost:3000 and check:
1. You're redirected to **/login**.
2. Sign in with CH's email + password → you land on **Home**.
3. The bottom tab bar shows **Home · Expenses · Fund · Budget · Assets**; tapping each navigates and the active tab turns terracotta.
4. Refresh the page — you stay logged in.
5. **Data is visible (RLS works):** the pages are placeholders in Phase 1, but you can confirm data is reachable by opening the browser devtools console on any authed page and it should not error. (Phase 2 renders the actual Home/Expenses screens over this data.)
6. On your phone: open the dev URL (or a deployed URL later) and confirm the layout is comfortable one-handed. (True "Add to Home Screen" install + push come in Phase 5.)

If sign-in fails with "Invalid login credentials", re-check the password in Step 3.
If you sign in but a later phase shows no data, the usual cause is a mismatch between
the UUIDs in Step 4 (profiles) and Step 5 (seed) — they must be the same two UUIDs.

---

## What's built (Phase 1)
- Next.js PWA foundation (App Router, Tailwind, installable-ready).
- Kita design tokens (the cream/terracotta system from your design).
- Supabase database: 13 tables, all money in cents, **household-scoped Row Level Security** so only your household sees your data.
- Your spreadsheet imported: joint fund, budget, monthly commitments, 81 expenses, and 5 assets (TreeO/condo, Myvi, Alza, AIA-CH, AIA-JC) with their transactions/schedules.
- Email+password login, session persistence, route protection.
- The app shell + bottom tabs (screens are placeholders — filled in next phases).
- Tested currency formatter (RM) and EN/中文 i18n primitives.

## What's next (later phases)
- **Phase 2:** Home dashboard, Add-Expense flow, Expenses list (the daily driver).
- **Phase 3:** Joint Fund + Budget screens.
- **Phase 4:** Assets module screens + Personal ledgers (also seeds `ledger_entries`).
- **Phase 5:** Settings (language toggle, invite your wife, notification toggles) + PWA install + push reminders.
- **Phase 6:** Deploy to Vercel; install on both phones.
