# Phase 9 — Recurring & Monthly Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the two remaining manual monthly chores from Kita — retyping recurring personal-ledger lines each month, and hand-posting TreeO's monthly commitment inflow — by adding a one-tap "Copy last month" to `/personal` and an idempotent auto-post step inside the existing daily cron.

**Architecture:** Follows the established `<domain>.ts` / `<domain>-shared.ts` split. All new decision logic (which month to clone from; which commitments to post today) lives as pure functions in `-shared.ts` files with colocated vitest tests. The copy path is a user-invoked `'use server'` action scoped via `getMembership()`; the auto-post path is admin-client-only and lives strictly inside `runReminderScan` (the sole existing cron scan), matching how push already works. No schema changes.

**Tech Stack:** Next.js 16 App Router · React 19 · Supabase (Postgres + RLS) · web-push · vitest + jsdom.

## Global Constraints

- **Next.js 16 with breaking changes** — read `node_modules/next/dist/docs/` before writing any Next.js API code; heed deprecation notices.
- **All money is integer cents** (`number` in TS, `bigint` in Postgres) — never floats. No new formatting; reuse existing `MoneyText` / `formatRM`.
- **Household scoping:** every user-path query filters by `householdId` from `getMembership()` and goes through the **anon** client (`@/lib/supabase/server`) so RLS applies. The **admin** client (`@/lib/supabase/admin`) is used **only inside `runReminderScan`**, never in a user path.
- **Client-invoked server actions return `{ ok: boolean; error?: string }`** (existing convention in `personal/actions.ts`, `assets/actions.ts`).
- **i18n:** every user-facing string is a key added to **both** `en` and `zh` blocks in `src/i18n/dictionaries.ts`; look up via `t(locale, key)` / `useT()`. EN is the fallback.
- **UI primitives:** interactive controls use `min-h-[44px]`, `pressable` / `pressable-opacity`, CSS custom properties (`var(--primary)`, `var(--surface)`, `var(--hairline)`, `var(--muted)`, …), and `lucide-react` icons. Reuse `Card`/`HeroCard`/`Spinner`.
- **Testing:** pure logic gets colocated `*.test.ts`; run with `npx vitest run <file>`. The `@/` alias maps to `src/`.
- **Money key already used:** property assets store the commitment amount at `metadata.monthlyCommitmentCents` (integer cents) — confirmed in `AddAssetForm.tsx` and `EditAssetForm.tsx`. Do not invent a new key.

---

## Judgment calls baked into this plan (read before starting)

1. **Copy ALL entries, not just expenses.** The seed shows each member's months are near-identical *line sets* including recurring income (e.g. salary). Copying only expenses would force re-typing income every month — the exact chore this removes. So "Copy last month" clones both `income` and `expense` rows (`description`, `amount_cents`, `remark`, `entry_type`).
2. **Idempotency is enforced inside the action/scan, not by a DB constraint.** There is no unique key on `ledger_entries` or `asset_transactions`, and adding one is out of scope (spec: "No schema changes expected"). Both new write paths **re-check emptiness/existence immediately before inserting**.
3. **The TreeO seed asset has NO `metadata.monthlyCommitmentCents`.** `supabase/seed/seed.sql` line 124 inserts TreeO with only `opening_balance_cents`; its metadata defaults to `{}`. Therefore auto-post will correctly **do nothing** for TreeO until the user sets the commitment amount once via the Phase 7 **edit-asset sheet** (`EditAssetForm.tsx` already writes `monthlyCommitmentCents` for `property`). This is expected, not a bug — call it out to the user.
4. **No push notification for auto-post (YAGNI).** The daily cron already sends a "Monthly commitments due" push on the 1st (`push.monthly.*`). A second "we posted it for you" push overlaps and adds copy + failure surface for no clear value. Skipped deliberately; noted as possible future polish.

---

## File Structure

- `src/lib/data/personal-shared.ts` — **modify.** Add pure `pickCopySourceMonth(...)`. (Client-safe, no supabase.)
- `src/lib/data/personal-shared.test.ts` — **modify.** Tests for `pickCopySourceMonth`.
- `src/app/(app)/personal/actions.ts` — **modify.** Add `copyLastMonth(...)` server action.
- `src/app/(app)/personal/page.tsx` — **modify.** Compute the copy-source period and pass to the view.
- `src/app/(app)/personal/PersonalView.tsx` — **modify.** Render the "Copy last month" button in the empty state.
- `src/lib/data/reminders-shared.ts` — **modify.** Add pure `monthCommitmentPosts(...)`.
- `src/lib/data/reminders-shared.test.ts` — **modify.** Tests for `monthCommitmentPosts`.
- `src/lib/data/reminders.ts` — **modify.** Extend `runReminderScan` to auto-post commitments before returning.
- `src/i18n/dictionaries.ts` — **modify.** Add `personal.copyLastMonth` + `error.not_empty` (both locales).

---

## Task 1: Pure copy-source-month selection

**Files:**
- Modify: `src/lib/data/personal-shared.ts`
- Test: `src/lib/data/personal-shared.test.ts`

**Interfaces:**
- Consumes: `LedgerEntry` (already exported from this file).
- Produces:
  - `pickCopySourceMonth(availableMonths: string[], targetPeriod: string): string | null` — given period-date ISO strings like `"2026-06-01"` (as returned in `PersonalLedger.availableMonths`) and the target month's period `"2026-07-01"`, returns the most recent period strictly earlier than `targetPeriod`, or `null` if none. Order of `availableMonths` is not assumed.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/data/personal-shared.test.ts` (add `pickCopySourceMonth` to the existing import from `./personal-shared`):

```ts
import { pickCopySourceMonth } from './personal-shared'

describe('pickCopySourceMonth', () => {
  it('returns the most recent month strictly before the target', () => {
    const months = ['2026-06-01', '2026-05-01', '2026-04-01']
    expect(pickCopySourceMonth(months, '2026-07-01')).toBe('2026-06-01')
  })
  it('ignores the target month itself and any later months', () => {
    const months = ['2026-08-01', '2026-07-01', '2026-06-01']
    expect(pickCopySourceMonth(months, '2026-07-01')).toBe('2026-06-01')
  })
  it('does not assume input ordering', () => {
    const months = ['2026-04-01', '2026-06-01', '2026-05-01']
    expect(pickCopySourceMonth(months, '2026-07-01')).toBe('2026-06-01')
  })
  it('returns null when there is no earlier month', () => {
    expect(pickCopySourceMonth(['2026-07-01'], '2026-07-01')).toBeNull()
    expect(pickCopySourceMonth([], '2026-07-01')).toBeNull()
  })
})
```

If `personal-shared.test.ts` currently imports only some names from `./personal-shared`, extend that import line to include `pickCopySourceMonth` instead of adding a second import from the same module.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/data/personal-shared.test.ts`
Expected: FAIL — `pickCopySourceMonth is not a function` / not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `src/lib/data/personal-shared.ts`:

```ts
/**
 * Given the member's months with data (period-date ISO strings, e.g. "2026-06-01")
 * and the target month's period, return the most recent month strictly earlier than
 * the target to clone from, or null when there is nothing earlier. Input order is not
 * assumed. ISO date strings are lexicographically comparable, so string `<` is correct.
 */
export function pickCopySourceMonth(availableMonths: string[], targetPeriod: string): string | null {
  const earlier = availableMonths.filter((p) => p < targetPeriod)
  if (earlier.length === 0) return null
  return earlier.reduce((a, b) => (a > b ? a : b))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/data/personal-shared.test.ts`
Expected: PASS (all describe blocks).

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/personal-shared.ts src/lib/data/personal-shared.test.ts
git commit -m "feat(personal): pure pickCopySourceMonth helper"
```

---

## Task 2: "Copy last month" action + UI

Wire the pure helper into a server action and surface a one-tap button in the empty-month state of `/personal`.

**Files:**
- Modify: `src/app/(app)/personal/actions.ts`
- Modify: `src/app/(app)/personal/page.tsx`
- Modify: `src/app/(app)/personal/PersonalView.tsx`
- Modify: `src/i18n/dictionaries.ts`

**Interfaces:**
- Consumes:
  - `pickCopySourceMonth(availableMonths: string[], targetPeriod: string): string | null` (Task 1).
  - `getMembership()` from `@/lib/data/household` (returns `{ householdId, memberCode }` or null).
  - Existing action shape `{ ok: boolean; error?: string }`.
  - Table `ledger_entries` columns: `household_id, owner_member_code, period` (date), `entry_type` (`'income'|'expense'`), `description`, `amount_cents` (bigint), `remark`.
- Produces:
  - `copyLastMonth(input: { member: 'CH' | 'JC'; targetPeriod: string }): Promise<{ ok: boolean; error?: string }>` — clones the most recent earlier month's entries into `targetPeriod`. Idempotency-safe: no-ops with `error: 'not_empty'` if the target month already has entries.
  - New i18n keys `personal.copyLastMonth`, `error.not_empty`.

- [ ] **Step 1: Add the server action**

Append to `src/app/(app)/personal/actions.ts`. Note the existing top-of-file imports already include `revalidatePath`, `createClient`, `getMembership`, and `validateLedgerInput` — add `pickCopySourceMonth` to the existing import from `@/lib/data/personal-shared`:

```ts
// change the existing import line to:
import { validateLedgerInput, pickCopySourceMonth } from '@/lib/data/personal-shared'
```

Then append the action:

```ts
export async function copyLastMonth(input: {
  member: 'CH' | 'JC'
  targetPeriod: string
}): Promise<{ ok: boolean; error?: string }> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }
  if (input.member !== 'CH' && input.member !== 'JC') return { ok: false, error: 'invalid_member' }
  const supabase = await createClient()

  // Idempotency guard: re-check the target month is still empty inside the action,
  // so a double-tap (or a race) cannot duplicate the copy.
  const { data: existing, error: existErr } = await supabase
    .from('ledger_entries')
    .select('id')
    .eq('household_id', m.householdId)
    .eq('owner_member_code', input.member)
    .eq('period', input.targetPeriod)
    .limit(1)
  if (existErr) { console.error('copyLastMonth exist:', existErr.message); return { ok: false, error: 'save_failed' } }
  if ((existing ?? []).length > 0) return { ok: false, error: 'not_empty' }

  // Find the source month: the most recent month with data strictly before the target.
  const { data: periodRows, error: periodsErr } = await supabase
    .from('ledger_entries')
    .select('period')
    .eq('household_id', m.householdId)
    .eq('owner_member_code', input.member)
  if (periodsErr) { console.error('copyLastMonth periods:', periodsErr.message); return { ok: false, error: 'save_failed' } }
  const availableMonths = Array.from(new Set((periodRows ?? []).map((r) => r.period as string)))
  const sourcePeriod = pickCopySourceMonth(availableMonths, input.targetPeriod)
  if (!sourcePeriod) return { ok: false, error: 'nothing_to_copy' }

  // Read the source month's entries (all types — income lines like salary recur too).
  const { data: sourceRows, error: sourceErr } = await supabase
    .from('ledger_entries')
    .select('entry_type, description, amount_cents, remark')
    .eq('household_id', m.householdId)
    .eq('owner_member_code', input.member)
    .eq('period', sourcePeriod)
  if (sourceErr) { console.error('copyLastMonth source:', sourceErr.message); return { ok: false, error: 'save_failed' } }
  const rows = sourceRows ?? []
  if (rows.length === 0) return { ok: false, error: 'nothing_to_copy' }

  const clones = rows.map((r) => ({
    household_id: m.householdId,
    owner_member_code: input.member,
    period: input.targetPeriod,
    entry_type: r.entry_type as 'income' | 'expense',
    description: r.description as string,
    amount_cents: r.amount_cents as number,
    remark: (r.remark as string | null) ?? null,
  }))
  const { error: insErr } = await supabase.from('ledger_entries').insert(clones)
  if (insErr) { console.error('copyLastMonth insert:', insErr.message); return { ok: false, error: 'save_failed' } }

  revalidatePath('/personal'); revalidatePath('/')
  return { ok: true }
}
```

- [ ] **Step 2: Add i18n keys (both locales)**

In `src/i18n/dictionaries.ts`, in the **en** block add `personal.copyLastMonth` next to the other `personal.*` keys (around line 148) and `error.not_empty` + `error.nothing_to_copy` next to the other `error.*` keys (around line 62):

```ts
    'personal.copyLastMonth': 'Copy last month',
```
```ts
    'error.not_empty': 'This month already has entries',
    'error.nothing_to_copy': 'No earlier month to copy from',
```

In the **zh** block add the mirrors next to the corresponding `personal.*` (around line 333) and `error.*` (around line 248) keys:

```ts
    'personal.copyLastMonth': '复制上个月',
```
```ts
    'error.not_empty': '本月已有记录',
    'error.nothing_to_copy': '没有可复制的上个月',
```

- [ ] **Step 3: Pass the copy-source flag from the page**

In `src/app/(app)/personal/page.tsx`, import the helper and compute whether a source month exists, then pass it to the view. Add to the imports:

```ts
import { pickCopySourceMonth } from '@/lib/data/personal-shared'
```

Replace the final `return` line with a computed flag (the `ledger` variable already holds `availableMonths` for the selected member):

```ts
  const pad = (n: number) => String(n).padStart(2, '0')
  const targetPeriod = `${year}-${pad(month)}-01`
  const canCopyLastMonth = pickCopySourceMonth(ledger.availableMonths, targetPeriod) !== null

  return (
    <PersonalView
      member={member}
      year={year}
      month={month}
      ledger={ledger}
      canCopyLastMonth={canCopyLastMonth}
    />
  )
```

- [ ] **Step 4: Render the button in the empty state**

In `src/app/(app)/personal/PersonalView.tsx`:

Add `copyLastMonth` to the action import (line 12):

```ts
import { addLedgerEntry, updateLedgerEntry, deleteLedgerEntry, copyLastMonth } from './actions'
```

Add `Copy` to the lucide import (add the import if none exists near the other imports):

```ts
import { Copy } from 'lucide-react'
```

Add `canCopyLastMonth` to the `Props` type and destructure it:

```ts
type Props = {
  member: Member
  year: number
  month: number
  ledger: Ledger
  canCopyLastMonth: boolean
}
```
```ts
export function PersonalView({ member, year, month, ledger, canCopyLastMonth }: Props) {
```

Replace the empty-state paragraph (the `isEmpty ? (...) : (...)` branch, currently just the `<p>… personal.empty …</p>`) with the paragraph plus a copy button. The `periodISO` for the selected month is `${year}-${pad(month)}-01` (the same expression already passed to `<AddEntry>`):

```tsx
        {isEmpty ? (
          <div className="flex flex-col items-center gap-4 py-10">
            <p className="text-center text-sm font-semibold text-[var(--faint)]">{t('personal.empty')}</p>
            {canCopyLastMonth && (
              <CopyLastMonth member={member} periodISO={`${year}-${pad(month)}-01`} />
            )}
          </div>
        ) : (
```

Add the `CopyLastMonth` component near the other local components (e.g. above `AddEntry`):

```tsx
function CopyLastMonth({ member, periodISO }: { member: Member; periodISO: string }) {
  const t = useT()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setBusy(true)
    setError(null)
    const res = await copyLastMonth({ member, targetPeriod: periodISO })
    setBusy(false)
    if (!res.ok) { setError(res.error ?? 'save_failed'); return }
    router.refresh()
  }

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        aria-busy={busy}
        className="pressable flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[var(--primary)] px-5 py-3 text-sm font-bold text-[var(--primary)] disabled:opacity-40"
      >
        {busy ? <Spinner size={16} /> : <Copy size={16} />}
        {t('personal.copyLastMonth')}
      </button>
      {error && <p role="alert" className="text-xs font-semibold text-[var(--danger)]">{t(`error.${error}`)}</p>}
    </div>
  )
}
```

- [ ] **Step 5: Verify it compiles and lints**

Run: `npm run lint`
Expected: no errors in the three modified files (`page.tsx`, `PersonalView.tsx`, `actions.ts`).

- [ ] **Step 6: Manual smoke check (optional but recommended)**

Run `npm run dev`, open `/personal`, step to a month with no entries for the selected member while an earlier month has data. Expected: "Copy last month" button appears; tapping it clones the earlier month's income + expense rows into the shown month; tapping again is impossible because the month is no longer empty (button gone). If you force a second call it returns `error: 'not_empty'`.

- [ ] **Step 7: Commit**

```bash
git add src/app/\(app\)/personal/actions.ts src/app/\(app\)/personal/page.tsx src/app/\(app\)/personal/PersonalView.tsx src/i18n/dictionaries.ts
git commit -m "feat(personal): one-tap Copy last month for recurring ledger lines"
```

---

## Task 3: Pure monthly-commitment post selection

Decide which property assets should get a `monthly_commitment` inflow posted today, given the date and what already exists this month.

**Files:**
- Modify: `src/lib/data/reminders-shared.ts`
- Test: `src/lib/data/reminders-shared.test.ts`

**Interfaces:**
- Produces:
  - `type CommitmentAsset = { assetId: string; householdId: string; amountCents: number }`
  - `type ExistingCommitment = { assetId: string; dateISO: string }`
  - `type CommitmentPost = { assetId: string; householdId: string; amountCents: number; dateISO: string }`
  - `monthCommitmentPosts(todayISO: string, assets: CommitmentAsset[], existing: ExistingCommitment[]): CommitmentPost[]` — returns `[]` unless `todayISO` is the 1st of a month (UTC). For each asset with `amountCents > 0` that has no existing commitment in the current calendar month, returns a post dated `todayISO`.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/data/reminders-shared.test.ts` (add `monthCommitmentPosts` to the existing import from `./reminders-shared`):

```ts
import { monthCommitmentPosts } from './reminders-shared'

const asset = (id: string, amountCents = 197058) => ({ assetId: id, householdId: 'h1', amountCents })

describe('monthCommitmentPosts', () => {
  it('returns nothing on a non-first day', () => {
    expect(monthCommitmentPosts('2026-08-15', [asset('a1')], [])).toEqual([])
  })
  it('posts on the 1st for a configured asset with no existing commitment this month', () => {
    expect(monthCommitmentPosts('2026-08-01', [asset('a1')], [])).toEqual([
      { assetId: 'a1', householdId: 'h1', amountCents: 197058, dateISO: '2026-08-01' },
    ])
  })
  it('skips an asset that already has a commitment this month (any day)', () => {
    const existing = [{ assetId: 'a1', dateISO: '2026-08-01' }]
    expect(monthCommitmentPosts('2026-08-01', [asset('a1')], existing)).toEqual([])
  })
  it('skips based on month, not exact date (commitment dated later in month still counts)', () => {
    const existing = [{ assetId: 'a1', dateISO: '2026-08-03' }]
    expect(monthCommitmentPosts('2026-08-01', [asset('a1')], existing)).toEqual([])
  })
  it('does not skip when the only existing commitment is a different month', () => {
    const existing = [{ assetId: 'a1', dateISO: '2026-07-01' }]
    expect(monthCommitmentPosts('2026-08-01', [asset('a1')], existing)).toEqual([
      { assetId: 'a1', householdId: 'h1', amountCents: 197058, dateISO: '2026-08-01' },
    ])
  })
  it('ignores assets with a zero/absent commitment amount', () => {
    expect(monthCommitmentPosts('2026-08-01', [asset('a1', 0)], [])).toEqual([])
  })
  it('handles multiple assets independently', () => {
    const assets = [asset('a1'), asset('a2', 50000)]
    const existing = [{ assetId: 'a1', dateISO: '2026-08-01' }]
    expect(monthCommitmentPosts('2026-08-01', assets, existing)).toEqual([
      { assetId: 'a2', householdId: 'h1', amountCents: 50000, dateISO: '2026-08-01' },
    ])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/data/reminders-shared.test.ts`
Expected: FAIL — `monthCommitmentPosts is not a function`.

- [ ] **Step 3: Write minimal implementation**

Append to `src/lib/data/reminders-shared.ts`:

```ts
export type CommitmentAsset = { assetId: string; householdId: string; amountCents: number }
export type ExistingCommitment = { assetId: string; dateISO: string }
export type CommitmentPost = { assetId: string; householdId: string; amountCents: number; dateISO: string }

/**
 * On the 1st of the month (UTC), return one monthly_commitment post per configured
 * property asset that does not already have a commitment dated in the current calendar
 * month. Month-level (not exact-date) idempotency: a commitment posted any day this
 * month suppresses the auto-post. Off the 1st, returns [].
 */
export function monthCommitmentPosts(
  todayISO: string,
  assets: CommitmentAsset[],
  existing: ExistingCommitment[],
): CommitmentPost[] {
  const today = new Date(todayISO + 'T00:00:00Z')
  if (today.getUTCDate() !== 1) return []
  const monthPrefix = todayISO.slice(0, 7) // "YYYY-MM"
  const already = new Set(
    existing.filter((e) => e.dateISO.slice(0, 7) === monthPrefix).map((e) => e.assetId),
  )
  return assets
    .filter((a) => a.amountCents > 0 && !already.has(a.assetId))
    .map((a) => ({
      assetId: a.assetId,
      householdId: a.householdId,
      amountCents: a.amountCents,
      dateISO: todayISO,
    }))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/data/reminders-shared.test.ts`
Expected: PASS (existing `dueReminders` tests plus the new block).

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/reminders-shared.ts src/lib/data/reminders-shared.test.ts
git commit -m "feat(reminders): pure monthCommitmentPosts selection helper"
```

---

## Task 4: Auto-post monthly commitments inside the cron scan

Extend `runReminderScan` (admin-client path, runs 01:00 UTC daily via `GET /api/reminders/run`) so that on the 1st it inserts the recurring `monthly_commitment` inflow for each property asset that has one configured.

**Files:**
- Modify: `src/lib/data/reminders.ts`

**Interfaces:**
- Consumes:
  - `monthCommitmentPosts`, `CommitmentAsset`, `ExistingCommitment` (Task 3).
  - Admin client `createAdminClient()` (already imported in this file).
  - Table `assets`: `id, household_id, metadata` (jsonb) where `type = 'property'` and `metadata.monthlyCommitmentCents` is integer cents (may be absent).
  - Table `asset_transactions`: insert with `asset_id, household_id, date, description, amount_cents, direction('in'), txn_type('monthly_commitment'), settled(false)`.
- Produces:
  - `runReminderScan` return type widens to `{ sent: number; posted: number }` where `posted` is the count of commitment rows inserted this run.

- [ ] **Step 1: Update the import**

In `src/lib/data/reminders.ts`, change the shared import line to also pull the new symbols:

```ts
import {
  dueReminders,
  monthCommitmentPosts,
  type ReminderRecipient,
  type BigPayment,
  type CommitmentAsset,
  type ExistingCommitment,
} from './reminders-shared'
```

- [ ] **Step 2: Add the auto-post block and widen the return type**

In `src/lib/data/reminders.ts`, change the function signature return type to `Promise<{ sent: number; posted: number }>`, and insert the auto-post block **after** the push-sending loop and **before** `return { sent }`. Replace the final `return { sent }` with the block below:

```ts
  // --- Auto-post recurring monthly commitments (property assets) ---
  // On the 1st, insert the "Monthly Commitment" inflow for each property asset that has
  // metadata.monthlyCommitmentCents set, unless one already exists this calendar month.
  // Idempotent: the cron may re-run the same day; existing rows suppress re-posting.
  let posted = 0
  const monthPrefix = todayISO.slice(0, 7)
  const { data: propAssets, error: assetsErr } = await admin
    .from('assets')
    .select('id, household_id, metadata')
    .eq('type', 'property')
    .eq('status', 'active')
  if (assetsErr) console.error('runReminderScan assets:', assetsErr.message)

  const commitmentAssets: CommitmentAsset[] = (propAssets ?? [])
    .map((a) => {
      const md = (a.metadata ?? {}) as Record<string, unknown>
      const cents = md.monthlyCommitmentCents
      return {
        assetId: a.id as string,
        householdId: a.household_id as string,
        amountCents: typeof cents === 'number' ? cents : 0,
      }
    })
    .filter((a) => a.amountCents > 0)

  if (commitmentAssets.length > 0) {
    const { data: existingTxns, error: existErr } = await admin
      .from('asset_transactions')
      .select('asset_id, date')
      .eq('txn_type', 'monthly_commitment')
      .gte('date', `${monthPrefix}-01`)
      .lte('date', `${monthPrefix}-31`)
    if (existErr) console.error('runReminderScan commitment txns:', existErr.message)
    const existing: ExistingCommitment[] = (existingTxns ?? []).map((r) => ({
      assetId: r.asset_id as string,
      dateISO: r.date as string,
    }))

    const toPost = monthCommitmentPosts(todayISO, commitmentAssets, existing)
    for (const p of toPost) {
      const { error: insErr } = await admin.from('asset_transactions').insert({
        asset_id: p.assetId,
        household_id: p.householdId,
        date: p.dateISO,
        description: 'Monthly Commitment',
        amount_cents: p.amountCents,
        direction: 'in',
        txn_type: 'monthly_commitment',
        settled: false,
      })
      if (insErr) { console.error('runReminderScan post commitment:', insErr.message); continue }
      posted++
    }
  }

  return { sent, posted }
```

Note: `${monthPrefix}-01`..`${monthPrefix}-31` is a deliberately loose date range that captures every day of the current month for the existence check (Postgres `date` accepts these bounds; a nonexistent day like Feb-31 as an *upper* bound simply includes all real days ≤ it). The precise month match is enforced by the pure `monthCommitmentPosts` idempotency logic.

- [ ] **Step 3: Verify existing tests still pass and it compiles**

Run: `npx vitest run src/lib/data/reminders-shared.test.ts`
Expected: PASS.

Run: `npm run lint`
Expected: no errors in `reminders.ts`. The route (`src/app/api/reminders/run/route.ts`) spreads `...result` into its JSON response, so the new `posted` field flows through automatically — no route change needed.

- [ ] **Step 4: Manual verification of idempotency (optional, needs service-role key)**

If `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` are set locally, set a property asset's `metadata.monthlyCommitmentCents` via the edit-asset sheet, then, on a machine clock or with a mocked `todayISO`, hit `GET /api/reminders/run` with `Authorization: Bearer $CRON_SECRET`. First call on the 1st returns `{ posted: 1 }` and inserts the inflow (settled=false); an immediate second call returns `{ posted: 0 }` (already exists). Calls on any other day return `{ posted: 0 }`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/reminders.ts
git commit -m "feat(reminders): auto-post monthly property commitments on the 1st"
```

---

## Self-Review

**1. Spec coverage (§3 items 7–8):**
- Item 7 "Copy last month" for personal ledgers → Tasks 1–2. Copies all entry types (justified), idempotent via in-action empty re-check (`not_empty`). ✔
- Item 8 auto-post monthly commitment to property assets on the 1st via existing cron, unsettled → Tasks 3–4. Idempotent via month-level existence check; reads `metadata.monthlyCommitmentCents`; admin client only inside `runReminderScan`. ✔
- Item 3 optional push → deliberately omitted (YAGNI), rationale documented. ✔
- Item 4 no schema changes → verified against `0001_schema.sql`; `asset_transactions` and `ledger_entries` have every column used. ✔ Noted TreeO seed lacks the metadata key and the user must set it once via the edit sheet. ✔

**2. Placeholder scan:** No TBD/TODO/"handle edge cases"/"similar to Task N". Every code step shows complete code. ✔

**3. Type consistency:**
- `pickCopySourceMonth(availableMonths, targetPeriod)` — same signature in Task 1 (def), Task 2 action + page. ✔
- `copyLastMonth({ member, targetPeriod })` — same shape in action def (Task 2 Step 1) and caller (Task 2 Step 4). ✔
- `monthCommitmentPosts(todayISO, assets, existing)` and `CommitmentAsset`/`ExistingCommitment`/`CommitmentPost` — identical between Task 3 def and Task 4 consumer; `CommitmentAsset` carries `householdId`, used in the insert. ✔
- `runReminderScan` return widened to `{ sent; posted }`; route spreads `...result`, no signature mismatch. ✔
- New error keys `error.not_empty`, `error.nothing_to_copy` added to both locales; both are returned by `copyLastMonth` and rendered via `t(\`error.${error}\`)`. ✔

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-07-05-phase-9-recurring.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
