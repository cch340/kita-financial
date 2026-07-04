# Kita — Deploy Guide (Phase 6)

This is the last step: put Kita on a real HTTPS URL (Vercel), point it at your
live Supabase, turn on the daily reminder cron, and install it on both phones.
Budget ~30–40 minutes. You do this once.

**Prerequisites**
- Your Supabase project is already live — schema + RLS applied and data seeded
  (that's `SETUP.md` Steps 1–5, plus `seed-phase4.sql`). If you haven't done
  that yet, finish `SETUP.md` first.
- The GitHub repo `cch340/kita-financial` (already set up).
- A free [Vercel](https://vercel.com) account (sign in with GitHub is easiest).

---

## Step 1 — Merge the phases into `main`

All the work lives in six stacked PRs (#1 → #6) that haven't been merged yet.
Vercel deploys your **production** from `main`, so `main` needs the code.

Merge them **in order** on GitHub — #1 first, then #2, and so on. Each PR
auto-retargets to `main` as the one below it merges, so you just click
"Merge" six times, top of the stack last:

1. #1 foundation → 2. #2 core screens → 3. #3 fund & budget →
4. #4 assets & personal → 5. #5 settings/PWA/push → 6. #6 deploy

After #6 merges, `main` has everything.

> Prefer to review first? Open each PR, skim the diff, merge. The final
> whole-branch review on each phase already passed with no blocking issues.

## Step 2 — Generate your Web Push (VAPID) keys

On your machine, in the repo folder:
```bash
npx web-push generate-vapid-keys
```
It prints a **Public Key** and a **Private Key**. Keep this output open — you'll
paste both into Vercel in Step 4. (These identify your app to the browsers'
push services. The private key is a secret — never commit it.)

## Step 3 — Import the repo into Vercel

1. Vercel dashboard → **Add New… → Project**.
2. **Import** `cch340/kita-financial`.
3. Framework preset: **Next.js** (auto-detected). Leave build/output settings at
   their defaults — don't override the build command.
4. **Before clicking Deploy**, expand **Environment Variables** and add all six
   below (Step 4). Then deploy.

## Step 4 — Set the environment variables

Add these to the Vercel project (Step 3's screen, or later under
**Settings → Environment Variables**). Apply each to **Production** (and
**Preview** if you want preview deploys to work too):

| Name | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | your Supabase Project URL | from Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your Supabase anon public key | public, safe in the browser |
| `SUPABASE_SERVICE_ROLE_KEY` | your Supabase service_role key | **secret** — server only |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | VAPID **public** key from Step 2 | public |
| `VAPID_PRIVATE_KEY` | VAPID **private** key from Step 2 | **secret** |
| `CRON_SECRET` | a long random string you make up | **secret** — protects the cron URL |

For `CRON_SECRET`, any long random value works, e.g.:
```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```
Vercel automatically sends this as `Authorization: Bearer <CRON_SECRET>` when it
runs the cron — Kita's `/api/reminders/run` route rejects anything else with a
401, so nobody else can trigger your reminders.

If you added the env vars **after** the first deploy, trigger a redeploy
(**Deployments → ⋯ → Redeploy**) so they take effect.

## Step 5 — Deploy and confirm the cron is registered

1. Deploy (or redeploy). Wait for the green **Ready**.
2. Open your production URL → you should land on **/login**. Sign in as CH → Home.
3. Confirm the cron: Vercel project → **Settings → Cron Jobs**. You should see
   `/api/reminders/run` scheduled `0 1 * * *`. (`vercel.json` in the repo defines
   it; Vercel picks it up automatically on deploy.)
   - The schedule is **01:00 UTC = 09:00 Malaysia time**, every day. It sends the
     "monthly commitments" nudge on the 1st of each month, and the "yearly big
     payment" nudge when a payment falls within the next 7 days.
   - On Vercel's free (Hobby) plan, cron runs once per day and only on
     production — which is exactly what this schedule needs.

> Want to test the cron by hand? From the Vercel Cron Jobs page you can **Run**
> it. A successful run returns `{ "ok": true, "sent": N }`. (It only actually
> pushes if a reminder is due *today* and someone is subscribed.)

## Step 6 — Install on both phones + turn on push

Do this on **each** phone (yours and JC's), signed in as that person.

**iPhone (Safari):**
1. Open your production URL in **Safari** and sign in.
2. Tap the **Share** button → **Add to Home Screen** → **Add**.
3. Open **Kita from the Home Screen icon** (not Safari — push only works from
   the installed app on iOS).
4. Tap the **gear** (top-right of Home) → **Settings** → turn **Push
   notifications** on → accept the permission prompt.
5. Tap **Send a test notification** — you should get a Kita notification.

**Android (Chrome):**
1. Open the URL in **Chrome** and sign in.
2. Chrome will offer **Install app** (or menu ⋮ → **Install app / Add to Home
   screen**).
3. Open Kita → **Settings** → **Push notifications** on → accept → **Send a
   test notification**.

Set your **language** (EN / 中文) in Settings while you're there — it's
per-person.

## Step 7 — Verify two-device sync

1. On JC's phone, add an expense (Home → the ＋ button).
2. On your phone, pull-to-refresh / reopen — the expense appears. Same joint
   fund, budget, assets. (Everything is scoped to your shared household, so you
   both see the same joint data; Personal ledgers stay separate per person.)

That's it — Kita is live. 🎉

---

## Troubleshooting

- **Push test does nothing on iPhone:** you must open Kita from the **Home
  Screen icon**, not Safari, and be on **iOS 16.4+**. Re-check the permission
  was allowed (iOS Settings → Notifications → Kita).
- **"Push isn't supported on this device":** the browser lacks the Push API
  (e.g. an in-app browser). Use Safari (iOS) or Chrome (Android), installed.
- **Cron never fires:** confirm `CRON_SECRET` is set in Vercel **Production**,
  the job shows under Settings → Cron Jobs, and you're on a deployed
  **production** URL (crons don't run on preview on Hobby).
- **Signed in but no data:** the usual cause is the Supabase profile UUIDs
  (SETUP.md Step 4) not matching the seed UUIDs (Step 5). They must be the same
  two IDs.
- **Build fails on Vercel:** make sure all six env vars are present; a missing
  `NEXT_PUBLIC_SUPABASE_URL`/anon key breaks the client build.
- **Local push testing** (optional, before deploy): `next dev
  --experimental-https` (push needs HTTPS even locally).

## Optional next steps

- **Custom domain:** Vercel project → **Domains** → add e.g. `kita.yourname.com`.
- **Backups:** Supabase → Database → Backups (automatic on paid tiers).
