# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> The line above is not decorative. This repo runs **Next.js 16 with breaking changes** — read `node_modules/next/dist/docs/` for the relevant API before writing Next.js code.

## What this is

**Kita** — a family-finance PWA for a two-person household (members are hardcoded as **`CH`** and **`JC`**). Tracks a joint fund, budget, shared expenses, personal ledgers, and assets. Bilingual EN / 中文. Installable, with daily push reminders. Built and shipped in six phases (see `docs/superpowers/plans/`); all phases are complete and deployed.

Stack: Next.js 16 App Router · React 19 · Tailwind 4 · Supabase (Postgres + Auth + RLS) · web-push · deployed on Vercel.

## Commands

```bash
npm run dev            # dev server (localhost:3000)
next dev --experimental-https   # needed to test push (browsers require HTTPS for subscriptions)
npm run build
npm run lint           # eslint
npm test               # vitest run (one-shot)
npm run test:watch
npx vitest run src/lib/money.test.ts      # single test file
npx vitest run -t "formats"               # single test by name
```

Tests use vitest + jsdom, colocated as `*.test.ts` beside the code. The `@/` alias maps to `src/`.

## Architecture

### Route groups (`src/app/`)
- **`(app)/`** — authed screens (home, expenses, fund, budget, assets, personal, settings). `(app)/layout.tsx` wraps them in the phone-width shell (`max-w-[430px]`) + `BottomTabBar`, and provides locale via `LocaleProvider` from the user's `getMembership()`.
- **`(auth)/login/`** — the only unauthed route.
- **`api/reminders/run/`** — cron endpoint (see Push below).
- App icons / manifest use Next.js file conventions: `app/icon.svg`, `app/apple-icon.png`, `app/manifest.ts`.

### Auth & routing
`src/middleware.ts` calls `updateSession` (`src/lib/supabase/middleware.ts`) on every request, refreshes the Supabase session, and redirects: unauthenticated → `/login`, authenticated-on-login → `/`. The matcher excludes static assets, `sw.js`, and the manifest.

### Data layer (`src/lib/data/`) — the core pattern
Two files per domain:
- **`<domain>.ts`** — async server functions that read/write Supabase. They import `createClient` from `@/lib/supabase/server` (which pulls in `next/headers`), so they are **server-only**. Every function scopes queries to the caller's household via `getMembership()` (`household.ts`).
- **`<domain>-shared.ts`** — **pure**, framework-free helpers and types (no Supabase, no `next/headers`). These are what client components import, and what the unit tests target. Server modules re-export them for convenience.

Keep this split: putting pure logic in `-shared.ts` is what lets client components use it without dragging server-only modules into the bundle. When adding domain logic, put the testable pure part in `-shared.ts`.

### Server Actions
Mutations live in `actions.ts` files marked `'use server'`, colocated with their screen. Convention: parse `FormData`, call a data-layer function, then `revalidatePath(...)` the affected screens and `redirect(...)`. Errors are surfaced by redirecting back with an `?error=` query param.

### Money
**All money is integer cents** (`bigint` in Postgres, `number` in TS) — never floats. Format for display only, at the edge, with `formatRM` (`src/lib/money.ts`). `parseMoneyInput` converts user text → cents.

### Supabase clients (`src/lib/supabase/`)
- `server.ts` — `createClient()`, cookie-bound **anon** client for all normal reads/writes; subject to RLS.
- `client.ts` — browser client.
- `admin.ts` — `createAdminClient()`, **service-role** client, `import 'server-only'`. Bypasses RLS; use only where there is no user session (cron reminder scan, sending push). Do not use elsewhere.

### Security model
Every table is **household-scoped with Row Level Security** (`supabase/migrations/0002_rls.sql`), enforced by an `is_member(household_id)` helper. Data isolation is a DB guarantee, not app-level — always query through the anon client so RLS applies, and always filter by `householdId` from `getMembership()`.

### i18n
Custom lightweight system, not full next-intl routing. `t(locale, key)` (`src/i18n/index.ts`) looks up `dictionaries` with EN fallback. Locale comes from the user's profile (`language` column), provided through `LocaleProvider`. Bilingual DB columns use `name_en` / `name_zh`.

### PWA & push
- `public/sw.js` service worker, registered by `ServiceWorkerRegistrar`; `app/manifest.ts` is the web manifest.
- Push uses VAPID keys (`web-push`). Subscriptions stored in `push_subscriptions`.
- **`GET /api/reminders/run`** is the daily cron (Vercel Cron, `vercel.json`, `0 1 * * *`). It requires `Authorization: Bearer $CRON_SECRET` and 401s otherwise. It runs `runReminderScan` via the admin client.
- iOS only allows push after the app is installed via Safari → Add to Home Screen.

## Database
Schema in `supabase/migrations/0001_schema.sql`, RLS in `0002_rls.sql` — applied manually in the Supabase SQL editor (see `SETUP.md`). Seed data in `supabase/seed/`. There is no local Postgres / migration tooling in this repo; changes to the schema mean editing these SQL files and running them in the dashboard.

## Setup & deploy
Cloud setup (Supabase project, accounts, seed, env) is documented step-by-step in **`SETUP.md`**; production deploy (Vercel, cron, env, phone install) in **`DEPLOY.md`**. Env vars are listed in `.env.example`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `CRON_SECRET`.

## Design
Visual design is handed off, not authored here — the source system lives in `design_handoff_kita/` (cream/terracotta tokens, Kita icons). UI uses CSS custom properties (`var(--paper)`, `var(--peach)`, etc.) defined in `src/app/globals.css`. Reusable primitives are in `src/components/ui/`. Icons come from `lucide-react`.
