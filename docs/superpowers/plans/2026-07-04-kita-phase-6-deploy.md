# Kita Phase 6 — Deploy Implementation Plan

> **For agentic workers:** Phase 6 is primarily an operational runbook — the deploy runs on the user's own Vercel + Supabase accounts and secrets, which an agent cannot perform. The only repo deliverables are the Vercel Cron config, a small production-hardening fix, and the `DEPLOY.md` guide.

**Goal:** Take Kita live on Vercel (production) against the user's cloud Supabase, wire the daily reminder cron, and get it installed + verified on both phones.

**Architecture:** Vercel hosts the Next.js app (Fluid Compute, Node runtime). Cron: `vercel.json` `crons` → daily `GET /api/reminders/run`; Vercel auto-attaches `Authorization: Bearer $CRON_SECRET` when the `CRON_SECRET` env var is set, which the route already checks. Supabase stays the cloud project from `SETUP.md`.

## Deliverables (in-repo)

1. **`vercel.json`** — one cron entry: `{ "path": "/api/reminders/run", "schedule": "0 1 * * *" }` (01:00 UTC = 09:00 MYT; fires monthly-on-the-1st + the daily yearly-window check; once/day fits the Vercel Hobby plan).
2. **`src/lib/data/reminders.ts` hardening** — capture + `console.error` each admin query's error (the P5-review deferred item), so an unattended cron failure is visible in Vercel logs instead of silently sending nothing.
3. **`DEPLOY.md`** — the end-to-end go-live runbook (VAPID keys, Vercel import, env vars, deploy, verify cron, install on phones, verify sync + push, merge order, troubleshooting).

## Manual steps (user only — documented in DEPLOY.md)

- Supabase project already live (schema + RLS + seed) per `SETUP.md`.
- Generate VAPID keys; set all six env vars in Vercel (3 Supabase + 2 VAPID + CRON_SECRET).
- Merge the stacked PRs #1→#6 into `main`; connect the repo to Vercel; deploy production.
- iOS: Add to Home Screen → open Settings → toggle Push on → Send test.
- Verify two-device sync (both log in; one adds an expense; the other sees it).

## Verification

- `npx vitest run && npx tsc --noEmit && npm run build` stay green (config + logging change only; no behavior change to the happy path).
- `vercel.json` is valid JSON against the Vercel schema.
- After deploy: Vercel dashboard → the project → Settings → Cron Jobs shows the job; a manual trigger returns `{ ok: true, sent: N }` (401 without the secret).

## Notes

- The `middleware → proxy` deprecation warning (Next 16) is pre-existing and non-blocking; deploy is unaffected. Renaming is a separate follow-up.
- Reminder cadence is intentionally simple (at-most-daily, no per-send idempotency ledger) — acceptable for a once-daily cron and a two-person household.
