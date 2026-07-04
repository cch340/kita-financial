# Kita — Phase 3: Joint Fund & Budget — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Build the Joint Fund screen (handoff `2C`) and the Budget screen (handoff `2D`), wired to the household-scoped Supabase data, including a live "mark contribution paid" toggle.

**Architecture:** Server Components fetch through a thin data-access layer (`src/lib/data/fund.ts`, `budget.ts`); the pure shaping logic (month matrix, leading-paid collapse, per-category actual mapping) is unit-tested; the mark-paid mutation is a Server Action. Screens reuse the Phase 2 UI primitives.

**Tech Stack:** Next.js 16 App Router · Supabase (`@supabase/ssr`) · Tailwind v4 + Kita tokens · Vitest.

## Global Constraints

- **Currency:** `RM 1,234.56` via `formatRM`/`MoneyText`. Money is integer **cents** throughout.
- **Data isolation:** every query/mutation is household-scoped via `getMembership()` server-side; never accept a `household_id` (or a raw contribution id to mutate cross-household) from the client. The mark-paid action targets a row by `household_id + member_code + period`.
- **Members:** `CH` and `JC`. CH accent = peach/terracotta (`--member-ch`), JC = blue (`--member-jc`).
- **i18n:** all user-facing strings via `t()`/`useT()`; add new keys in BOTH `en` and `zh` (the locale-parity test enforces this). Budget category / commitment names come from the DB as `name_en`/`name_zh` — pick by locale (`locale==='zh' && name_zh ? name_zh : name_en`).
- **Design source of truth:** `design_handoff_kita/README.md` §2C and §2D. Bottom tabs unchanged; **Fund** active on 2C, **Budget** active on 2D.
- **Tokens only** (no hex): `--surface`, `--hero-grad`, `--primary`, `--positive-*`, `--pending-*`, `--member-ch`, `--member-jc`, `--peach`, `--info-*`, `--muted`, `--hairline`, `--ink`, `--ink-head`, `--subtle`.
- **Empty-DB resilience:** every screen renders without crashing on zero rows; no divide-by-zero in any progress/split bar (guard `total > 0 ? x/total : 0`).
- **Year scope:** "this year" figures filter contributions to the selected calendar year (`period` in `[year-01-01, (year+1)-01-01)`), NOT all-time.

---

## Data Realities

- Seeded `joint_fund_contributions`: 12 months × 2 members for 2026, each `status` `paid`/`pending` per the sheet (early months paid, later pending). `joint_fund_config`: CH expected 227000, JC 247000; JC carry-forward 133853, CH 0.
- `budget_categories` (from the sheet's "Money breakdown"): 7 rows — House, Food, Emergency fund, Leo insurance, Leo Food + diapers, Leo Clothes, Leo fund — each with `jc_cents`, `ch_cents`, `total_cents`. `monthly_commitments`: 8 rows (House installment, maintenance, water purifier, internet, electric/water bill, etc.).
- **Budget "actual spent per category" is best-effort:** budget-category names ("House", "Food", "Leo …") don't map 1:1 to the expense `category` enum (`food/groceries/transport/house/leo/dining/utilities/health`). A keyword mapping (§Task 3) approximates it; seeded expenses are all uncategorized, so per-category actuals start at 0 and fill as the user categorizes new expenses. The **overall** spent (sum of the month's expenses) is exact. Document this in the code.

---

## File Structure (Phase 3)

```
src/
├─ lib/data/
│  ├─ fund.ts                  # getFundOverview + pure buildFundMonths/collapseLeadingPaid + types
│  ├─ fund.test.ts             # TDD the pure shaping
│  ├─ budget.ts                # getBudget + pure spentForBudgetCategory + types
│  ├─ budget.test.ts           # TDD the mapping/aggregation
│  └─ home.ts                  # MODIFIED: year-scope yearContributedCents
├─ app/(app)/
│  ├─ fund/
│  │  ├─ page.tsx              # Joint Fund (2C) server component
│  │  ├─ FundView.tsx          # client: month table + mark-paid toggle
│  │  └─ actions.ts            # server action toggleContributionPaid
│  └─ budget/
│     └─ page.tsx              # Budget (2D) server component (+ small inline bars, or a BudgetBars.tsx if needed)
```

---

## Task 1: Fund data layer + mark-paid action

**Files:**
- Create: `src/lib/data/fund.ts`, `src/lib/data/fund.test.ts`, `src/app/(app)/fund/actions.ts`
- Modify: `src/lib/data/home.ts` (year-scope `yearContributedCents`)

**Interfaces:**
- Produces:
  - `type MemberCell = { amountCents: number; status: 'paid' | 'pending' } | null`
  - `type FundMonth = { month: number; periodISO: string; ch: MemberCell; jc: MemberCell }`
  - `type FundOverview = { year: number; expectedEachCents: { CH: number; JC: number }; carryForwardCents: number; yearContributedCents: number; yearExpectedCents: number; months: FundMonth[] }`
  - `buildFundMonths(rows, year): FundMonth[]` (pure)
  - `collapseLeadingPaid(months): { summary: { throughMonth: number; count: number; totalCents: number } | null; rest: FundMonth[] }` (pure)
  - `getFundOverview(year): Promise<FundOverview>` (server)
  - server action `toggleContributionPaid(member: 'CH'|'JC', periodISO: string): Promise<{ ok: boolean }>`

- [ ] **Step 1: Write failing tests for the pure shapers**

`src/lib/data/fund.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildFundMonths, collapseLeadingPaid } from './fund'

type Row = { member_code: 'CH' | 'JC'; period: string; amount_cents: number; status: 'paid' | 'pending' }
const r = (member_code: 'CH'|'JC', period: string, amount_cents: number, status: 'paid'|'pending'): Row =>
  ({ member_code, period, amount_cents, status })

describe('buildFundMonths', () => {
  it('produces 12 months with CH/JC cells filled from rows (null when absent)', () => {
    const rows = [
      r('CH', '2026-01-01', 227000, 'paid'),
      r('JC', '2026-01-01', 247000, 'paid'),
      r('CH', '2026-02-01', 227000, 'pending'),
    ]
    const months = buildFundMonths(rows, 2026)
    expect(months).toHaveLength(12)
    expect(months[0]).toEqual({ month: 1, periodISO: '2026-01-01', ch: { amountCents: 227000, status: 'paid' }, jc: { amountCents: 247000, status: 'paid' } })
    expect(months[1].ch).toEqual({ amountCents: 227000, status: 'pending' })
    expect(months[1].jc).toBeNull()
    expect(months[2].ch).toBeNull()
  })
})

describe('collapseLeadingPaid', () => {
  it('collapses the leading run of fully-paid months into a summary', () => {
    const months = buildFundMonths([
      r('CH','2026-01-01',227000,'paid'), r('JC','2026-01-01',247000,'paid'),
      r('CH','2026-02-01',227000,'paid'), r('JC','2026-02-01',247000,'paid'),
      r('CH','2026-03-01',227000,'pending'), r('JC','2026-03-01',247000,'paid'),
    ], 2026)
    const { summary, rest } = collapseLeadingPaid(months)
    expect(summary).toEqual({ throughMonth: 2, count: 2, totalCents: 948000 })
    expect(rest[0].month).toBe(3)
    expect(rest).toHaveLength(10)
  })
  it('returns null summary when the first month is not fully paid', () => {
    const months = buildFundMonths([r('CH','2026-01-01',227000,'pending')], 2026)
    const { summary, rest } = collapseLeadingPaid(months)
    expect(summary).toBeNull()
    expect(rest).toHaveLength(12)
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test` → Expected: FAIL (`./fund` not found).

- [ ] **Step 3: Implement `fund.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import { getMembership } from './household'
import { monthRange } from './summary'
import type { Member } from './types'

export type MemberCell = { amountCents: number; status: 'paid' | 'pending' } | null
export type FundMonth = { month: number; periodISO: string; ch: MemberCell; jc: MemberCell }
export type FundOverview = {
  year: number
  expectedEachCents: { CH: number; JC: number }
  carryForwardCents: number
  yearContributedCents: number
  yearExpectedCents: number
  months: FundMonth[]
}

type ContribRow = { member_code: Member; period: string; amount_cents: number; status: 'paid' | 'pending' }

const pad = (n: number) => String(n).padStart(2, '0')

export function buildFundMonths(rows: ContribRow[], year: number): FundMonth[] {
  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1
    const periodISO = `${year}-${pad(month)}-01`
    const cell = (m: Member): MemberCell => {
      const row = rows.find((x) => x.member_code === m && x.period === periodISO)
      return row ? { amountCents: row.amount_cents, status: row.status } : null
    }
    return { month, periodISO, ch: cell('CH'), jc: cell('JC') }
  })
}

export function collapseLeadingPaid(months: FundMonth[]) {
  let count = 0
  let totalCents = 0
  for (const m of months) {
    const bothPaid = m.ch?.status === 'paid' && m.jc?.status === 'paid'
    if (!bothPaid) break
    count++
    totalCents += (m.ch?.amountCents ?? 0) + (m.jc?.amountCents ?? 0)
  }
  if (count === 0) return { summary: null as null, rest: months }
  return { summary: { throughMonth: count, count, totalCents }, rest: months.slice(count) }
}

export async function getFundOverview(year: number): Promise<FundOverview> {
  const empty: FundOverview = {
    year, expectedEachCents: { CH: 0, JC: 0 }, carryForwardCents: 0,
    yearContributedCents: 0, yearExpectedCents: 0, months: buildFundMonths([], year),
  }
  const m = await getMembership()
  if (!m) return empty
  const supabase = await createClient()
  const { startISO } = monthRange(year, 1)
  const { startISO: nextYearStart } = monthRange(year + 1, 1)

  const [contribRes, configRes] = await Promise.all([
    supabase.from('joint_fund_contributions')
      .select('member_code, period, amount_cents, status')
      .eq('household_id', m.householdId).gte('period', startISO).lt('period', nextYearStart),
    supabase.from('joint_fund_config')
      .select('member_code, expected_monthly_cents, carry_forward_prev_year_cents')
      .eq('household_id', m.householdId),
  ])
  if (contribRes.error) console.error('getFundOverview contributions:', contribRes.error.message)
  if (configRes.error) console.error('getFundOverview config:', configRes.error.message)

  const rows = (contribRes.data ?? []) as ContribRow[]
  const config = (configRes.data ?? []) as { member_code: Member; expected_monthly_cents: number; carry_forward_prev_year_cents: number }[]

  const expectedEachCents = { CH: 0, JC: 0 }
  let carryForwardCents = 0
  for (const c of config) {
    expectedEachCents[c.member_code] = c.expected_monthly_cents
    carryForwardCents += c.carry_forward_prev_year_cents
  }
  const yearContributedCents = rows.filter((r) => r.status === 'paid').reduce((a, r) => a + r.amount_cents, 0)
  const yearExpectedCents = (expectedEachCents.CH + expectedEachCents.JC) * 12 + carryForwardCents

  return { year, expectedEachCents, carryForwardCents, yearContributedCents, yearExpectedCents, months: buildFundMonths(rows, year) }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test` → Expected: PASS (fund + prior suites).

- [ ] **Step 5: Implement the mark-paid Server Action**

`src/app/(app)/fund/actions.ts`:

```ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { getMembership } from '@/lib/data/household'
import { revalidatePath } from 'next/cache'

export async function toggleContributionPaid(
  member: 'CH' | 'JC',
  periodISO: string,
): Promise<{ ok: boolean }> {
  const m = await getMembership()
  if (!m) return { ok: false }
  const supabase = await createClient()
  // Read current status for this household+member+period, then flip it.
  const { data, error } = await supabase
    .from('joint_fund_contributions')
    .select('id, status')
    .eq('household_id', m.householdId).eq('member_code', member).eq('period', periodISO)
    .single()
  if (error || !data) { console.error('toggleContributionPaid read:', error?.message); return { ok: false } }
  const next = data.status === 'paid' ? 'pending' : 'paid'
  const { error: upErr } = await supabase
    .from('joint_fund_contributions').update({ status: next })
    .eq('id', data.id).eq('household_id', m.householdId)
  if (upErr) { console.error('toggleContributionPaid update:', upErr.message); return { ok: false } }
  revalidatePath('/fund'); revalidatePath('/')
  return { ok: true }
}
```

- [ ] **Step 6: Year-scope `home.ts` yearContributedCents**

In `src/lib/data/home.ts`, change the all-time paid-contributions query to filter to the current year (matching the Fund screen). Replace the `paidContribRes` query:

```ts
    supabase
      .from('joint_fund_contributions')
      .select('amount_cents')
      .eq('household_id', householdId)
      .eq('status', 'paid')
      .gte('period', monthRange(year, 1).startISO)
      .lt('period', monthRange(year + 1, 1).startISO),
```

(the rest of the computation stays; `yearContributedCents` now reflects the calendar year only).

- [ ] **Step 7: Verify + commit**

Run: `npm test` (pass), `npx tsc --noEmit` (clean), `npm run build` (ok).

```bash
git add src/lib/data/fund.ts src/lib/data/fund.test.ts src/app/\(app\)/fund/actions.ts src/lib/data/home.ts
git commit -m "feat: fund data layer (overview + mark-paid) + year-scope home contributions"
```

---

## Task 2: Joint Fund screen (2C)

**Files:**
- Create: `src/app/(app)/fund/page.tsx`, `src/app/(app)/fund/FundView.tsx`
- Add i18n keys (both locales): `fund.title`, `fund.contributed`, `fund.ofYear` ("of {x} this year" — pass the amount in the caller, so key can be `fund.ofYear` = "this year"), `fund.carryForward`, `fund.perMonthEach` ("/ mo each"), `fund.markPaid`, `fund.allPaid` ("all paid").

**Interfaces:**
- Consumes: `getFundOverview`, `collapseLeadingPaid`, `toggleContributionPaid`, `getMembership`, UI primitives, `useT`/`t`.

**Recreate handoff §2C.** `page.tsx` (server): `getFundOverview(currentYear)` + membership for locale; pass `overview` to `<FundView>`. `FundView` (client):
- Title `t('fund.title')` + a `{year}` pill.
- **Hero** (`HeroCard`): `t('fund.contributed')`, big `MoneyText(yearContributedCents)`, muted `{t('fund.ofYear')}: MoneyText(yearExpectedCents)`; a `ProgressBar value={yearExpectedCents>0 ? yearContributedCents/yearExpectedCents : 0}`; two chips: `t('fund.carryForward') · MoneyText(carryForwardCents)` and `MoneyText(expectedEachCents.CH or a combined) {t('fund.perMonthEach')}` (show `RM 2,270 / mo each` style — use CH+JC each; if they differ, show both e.g. `CH 2,270 · JC 2,470 / mo`).
- **Month table** (`Card`): header row (blank · `CH` avatar · `JC` avatar via `MemberAvatar`). Apply `collapseLeadingPaid(overview.months)`: if `summary` present, render a collapsed row `Jan–{monthName(throughMonth)} · {t('fund.allPaid')} · MoneyText(totalCents)`. Then each `rest` month as a row: month label (left) + a **CH cell** and **JC cell**. A cell:
  - `paid` → sage chip `✓ MoneyText(amountCents)` (StatusChip status='paid' + amount, or a sage pill).
  - `pending` and month **is the current month** → a **live "Mark paid" button** (terracotta) calling `toggleContributionPaid(member, periodISO)`; on `!ok` show a small inline error (`t('error.save_failed')`).
  - `pending` and not current month → a muted `pending` chip (StatusChip status='pending' + amount) that is ALSO tappable to toggle (allow correcting any month), but style the current month highlighted.
  - `null` cell → an em-dash placeholder.
  Highlight the current month's row (e.g. subtle background).
- Bottom tab bar shows Fund active automatically (existing tab bar).

- [ ] **Step 1: Add i18n keys (en + zh)**

Add to both maps in `src/i18n/dictionaries.ts` (en shown; add matching zh): `fund.title`='Joint Fund'/'共同基金', `fund.contributed`='Contributed'/'已缴', `fund.ofYear`='this year'/'今年', `fund.carryForward`='Carry-forward'/'结转', `fund.perMonthEach`='/ mo each'/'/月 每人', `fund.markPaid`='Mark paid'/'标记已付', `fund.allPaid`='all paid'/'全部已付'.

- [ ] **Step 2: Build `FundView.tsx` (client)** per the spec above. Use a small `MONTH_SHORT` localized via `formatMonthYear`-style, or reuse month number → name. For month names, add a helper or reuse `formatMonthYear(year, month, locale)` and take the month part; simplest: show `formatMonthYear(year, month, locale)` per row is verbose — instead show a short month label. Add `monthShort(month, locale)` in `summary.ts` if needed (en 'Jul', zh '7月'); if you add it, add a test. Keep it minimal.

- [ ] **Step 3: Build `page.tsx` (server component).**

- [ ] **Step 4: Verify + commit**

Run: `npm test`, `npx tsc --noEmit`, `npm run build` (route `/fund` present). Paste results.

```bash
git add src/app/\(app\)/fund/page.tsx src/app/\(app\)/fund/FundView.tsx src/i18n/dictionaries.ts src/lib/data/summary.ts src/lib/data/summary.test.ts
git commit -m "feat: Joint Fund screen (2C) with live mark-paid toggle"
```

---

## Task 3: Budget data layer

**Files:**
- Create: `src/lib/data/budget.ts`, `src/lib/data/budget.test.ts`

**Interfaces:**
- Produces:
  - `type BudgetCategory = { nameEn: string; nameZh: string | null; jcCents: number; chCents: number; totalCents: number; spentCents: number }`
  - `type BudgetCommitment = { nameEn: string; nameZh: string | null; amountCents: number }`
  - `type BudgetData = { overall: { totalCents: number; spentCents: number }; categories: BudgetCategory[]; commitments: BudgetCommitment[] }`
  - `expenseKeysForBudget(nameEn: string): string[]` (pure) — best-effort keyword mapping.
  - `spentForBudgetCategory(nameEn: string, byCategoryKey: Record<string, number>): number` (pure)
  - `getBudget(year: number, month: number): Promise<BudgetData>` (server)

- [ ] **Step 1: Write failing tests (pure mapping)**

`src/lib/data/budget.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { expenseKeysForBudget, spentForBudgetCategory } from './budget'

describe('expenseKeysForBudget', () => {
  it('maps budget category names to expense category keys (leo wins over food)', () => {
    expect(expenseKeysForBudget('House')).toEqual(['house', 'utilities'])
    expect(expenseKeysForBudget('Food')).toEqual(['food', 'groceries', 'dining'])
    expect(expenseKeysForBudget('Leo Food + diapers')).toEqual(['leo'])
    expect(expenseKeysForBudget('Emergency fund')).toEqual([])
  })
})
describe('spentForBudgetCategory', () => {
  it('sums the mapped expense-category totals', () => {
    const byKey = { food: 5000, groceries: 3000, dining: 2000, leo: 4000, house: 1000 }
    expect(spentForBudgetCategory('Food', byKey)).toBe(10000) // 5000+3000+2000
    expect(spentForBudgetCategory('Leo Clothes', byKey)).toBe(4000)
    expect(spentForBudgetCategory('Emergency fund', byKey)).toBe(0)
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test` → Expected: FAIL.

- [ ] **Step 3: Implement `budget.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import { getMembership } from './household'
import { monthRange } from './summary'

export type BudgetCategory = { nameEn: string; nameZh: string | null; jcCents: number; chCents: number; totalCents: number; spentCents: number }
export type BudgetCommitment = { nameEn: string; nameZh: string | null; amountCents: number }
export type BudgetData = { overall: { totalCents: number; spentCents: number }; categories: BudgetCategory[]; commitments: BudgetCommitment[] }

// Best-effort: budget-category display names -> expense category keys. 'leo' is
// checked first so "Leo Food + diapers" maps to baby spend, not general food.
export function expenseKeysForBudget(nameEn: string): string[] {
  const n = nameEn.toLowerCase()
  if (n.includes('leo')) return ['leo']
  if (n.includes('food')) return ['food', 'groceries', 'dining']
  if (n.includes('house')) return ['house', 'utilities']
  return []
}
export function spentForBudgetCategory(nameEn: string, byCategoryKey: Record<string, number>): number {
  return expenseKeysForBudget(nameEn).reduce((a, k) => a + (byCategoryKey[k] ?? 0), 0)
}

export async function getBudget(year: number, month: number): Promise<BudgetData> {
  const empty: BudgetData = { overall: { totalCents: 0, spentCents: 0 }, categories: [], commitments: [] }
  const m = await getMembership()
  if (!m) return empty
  const supabase = await createClient()
  const { startISO, endISO } = monthRange(year, month)

  const [catRes, commitRes, expRes] = await Promise.all([
    supabase.from('budget_categories')
      .select('name_en, name_zh, jc_cents, ch_cents, total_cents, sort_order')
      .eq('household_id', m.householdId).order('sort_order', { ascending: true }),
    supabase.from('monthly_commitments')
      .select('name_en, name_zh, amount_cents')
      .eq('household_id', m.householdId),
    supabase.from('expenses')
      .select('category, amount_cents')
      .eq('household_id', m.householdId).gte('date', startISO).lt('date', endISO),
  ])
  if (catRes.error) console.error('getBudget categories:', catRes.error.message)
  if (commitRes.error) console.error('getBudget commitments:', commitRes.error.message)
  if (expRes.error) console.error('getBudget expenses:', expRes.error.message)

  const expenses = (expRes.data ?? []) as { category: string | null; amount_cents: number }[]
  const byCategoryKey: Record<string, number> = {}
  let spentTotal = 0
  for (const e of expenses) {
    spentTotal += e.amount_cents
    const key = e.category ?? 'uncategorized'
    byCategoryKey[key] = (byCategoryKey[key] ?? 0) + e.amount_cents
  }

  const categories: BudgetCategory[] = ((catRes.data ?? []) as {
    name_en: string; name_zh: string | null; jc_cents: number; ch_cents: number; total_cents: number
  }[]).map((c) => ({
    nameEn: c.name_en, nameZh: c.name_zh, jcCents: c.jc_cents, chCents: c.ch_cents,
    totalCents: c.total_cents, spentCents: spentForBudgetCategory(c.name_en, byCategoryKey),
  }))
  const commitments: BudgetCommitment[] = ((commitRes.data ?? []) as {
    name_en: string; name_zh: string | null; amount_cents: number
  }[]).map((c) => ({ nameEn: c.name_en, nameZh: c.name_zh, amountCents: c.amount_cents }))

  const totalCents = categories.reduce((a, c) => a + c.totalCents, 0)
  return { overall: { totalCents, spentCents: spentTotal }, categories, commitments }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/budget.ts src/lib/data/budget.test.ts
git commit -m "feat: budget data layer (categories, commitments, best-effort actual spend)"
```

---

## Task 4: Budget screen (2D)

**Files:**
- Create: `src/app/(app)/budget/page.tsx` (replaces the placeholder). If the split/progress bars get complex, extract `src/app/(app)/budget/BudgetBars.tsx` (client) — otherwise inline.
- Add i18n keys (both locales): `budget.title`, `budget.left`, `budget.spent`, `budget.of`, `budget.commitments`, `budget.total`.

**Interfaces:**
- Consumes: `getBudget`, `getMembership` (locale + monthLabel via `formatMonthYear`), UI primitives, `t`.

**Recreate handoff §2D.** `page.tsx` (server): current year/month from `new Date()`; `getBudget(year, month)`; `membership` for locale + `formatMonthYear`. Layout:
- Title `t('budget.title')` + month pill (`formatMonthYear`).
- **Overall card** (`Card`): `MoneyText(spentCents) / MoneyText(totalCents)`, a `ProgressBar value={totalCents>0 ? spentCents/totalCents : 0}`, `MoneyText(totalCents - spentCents) {t('budget.left')}`.
- **Category cards** (one `Card` per category): localized name (`locale==='zh' && nameZh ? nameZh : nameEn`) + `MoneyText(totalCents)`; a **split bar** — a horizontal rounded bar split into a peach segment (JC, width `jcCents/totalCents`) and a blue segment (CH, width `chCents/totalCents`), with `JC MoneyText(jcCents)` / `CH MoneyText(chCents)` labels; a **budget-vs-actual bar** — width `totalCents>0 ? min(1, spentCents/totalCents) : 0`, colored sage (`--positive-*`) when `spentCents <= totalCents` else amber (`--pending-*`), with `MoneyText(spentCents) · {pct}%`.
- **Monthly commitments** section (`Card`): header `t('budget.commitments')` + `t('budget.total')` `MoneyText(sum amountCents)`; a row per commitment: localized name + `MoneyText(amountCents)`.
- Bottom tab bar shows Budget active automatically.

- [ ] **Step 1: Add i18n keys (en + zh)**

`budget.title`='Budget'/'预算', `budget.left`='left'/'剩余', `budget.spent`='spent'/'已花', `budget.of`='of'/'/', `budget.commitments`='Monthly commitments'/'每月固定支出', `budget.total`='Total'/'合计'.

- [ ] **Step 2: Build the split bar + budget-vs-actual bar.** Guard all widths against divide-by-zero.

- [ ] **Step 3: Build `page.tsx`** per §2D.

- [ ] **Step 4: Verify + commit**

Run: `npm test`, `npx tsc --noEmit`, `npm run build` (route `/budget` present). Paste results.

```bash
git add src/app/\(app\)/budget/page.tsx src/i18n/dictionaries.ts
git commit -m "feat: Budget screen (2D) — split bars, budget-vs-actual, commitments"
```

---

## Phase 3 Done — Definition of Done

- `/fund` shows the yearly contribution progress hero + a per-month CH/JC table; the current month's pending cell has a working **Mark paid** toggle that persists and updates the totals.
- `/budget` shows overall spent-vs-budget, per-category JC/CH split + best-effort actual bars, and the monthly-commitments list.
- All new strings render EN + 中文 (parity test green); money via `MoneyText`; no divide-by-zero on empty data.
- `npm test` green; `npm run build` succeeds.

Next: **Phase 4** (Assets module `3A`–`3E` + Personal `3F`).
```
