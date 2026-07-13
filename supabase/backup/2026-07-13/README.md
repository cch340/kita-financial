# Supabase backup — 2026-07-13

Full snapshot of the production Supabase project **kita-financial** (`nzjvtalrbcllneihelit`, ap-south-1, Postgres 17), taken via the Supabase management API.

## Contents

| Path | What it is |
| --- | --- |
| `data/*.json` | Every row of every `public` table (17 tables, 280 rows), one JSON file per table |
| `restore_data.sql` | The same data as FK-ordered `INSERT` statements, ready to run after the schema migrations |
| `auth_users.json` | The two `auth.users` accounts (id, email, timestamps). Passwords/hashes are **not** exportable via the API — users must be recreated (e.g. invite or `auth.admin.createUser`) with the **same UUIDs** so profiles/FKs line up |
| `schema/rls_policies.json` | Live RLS policies (18) as reported by `pg_policies` |
| `schema/functions.sql` | Live function definitions (`is_member`, `rls_auto_enable`) |
| `schema/indexes.sql` | All index definitions (30) |

Table DDL is not duplicated here — it already lives in `supabase/migrations/0001_schema.sql` and `0002_rls.sql`, and the live policies/functions/indexes above match them.

## Row counts

households 1 · profiles 2 · household_members 2 · joint_fund_config 2 · joint_fund_contributions 14 · monthly_commitments 8 · expense_categories 6 · vendors 8 · locations 8 · recurring_funds 14 · asset_categories 7 · assets 5 · expenses 80 · ledger_entries 72 · asset_transactions 52 · reminder_settings 0 · push_subscriptions 1

## Restore procedure

1. Create a Supabase project, run `supabase/migrations/0001_schema.sql` then `0002_rls.sql` in the SQL editor.
2. Recreate the two auth users with the exact UUIDs in `auth_users.json` (Dashboard → Authentication, or admin API with a fixed `id`).
3. Run `restore_data.sql` in the SQL editor.
4. Push subscriptions are device-bound; the saved row will likely be stale — re-enable notifications from the app instead.

## Notes / not included

- Edge functions: none exist in the project.
- Storage buckets: none used by this app.
- `push_subscriptions` contains the web-push endpoint + keys; treat this backup as private.
