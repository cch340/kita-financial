# Phase 10 — Reports & Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a server-rendered **Year Overview** report screen (spend-by-category-by-month, joint-fund year summary, per-member personal balance trend, year selector) plus **CSV export** downloads (expenses/year, personal ledger/member-year, asset transactions/asset), so the Excel workbook becomes an occasional output instead of a live document.

**Architecture:** Follow the repo's data-layer split. Pure aggregation (`report-shared.ts`) and pure CSV serialization (`csv-shared.ts`) are framework-free and unit-tested with vitest. A thin server module (`report.ts`) reads Supabase through the anon client scoped by `getMembership()`. The report screen is a **plain Server Component** (`report/page.tsx` → `ReportView.tsx` + `MonthBars.tsx`) — the year selector and download buttons are plain `<Link>`/`<a download>` anchors, so **no client component and no chart library are needed**. Exports are served by one Route Handler (`report/export/route.ts`) that streams `text/csv` with a `Content-Disposition: attachment` header, authed via the normal session so RLS applies.

**Tech Stack:** Next.js 16 App Router (Route Handlers per `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`) · React 19 Server Components · Tailwind 4 (CSS custom properties + CSS bars, mirroring `budget/BudgetBars.tsx`) · Supabase anon client + RLS · vitest + jsdom.

## Global Constraints

- **NO new npm dependencies.** CSV only — no `xlsx`/`exceljs`. (CSV opens directly in Excel and Google Sheets; a UTF-8 BOM is prepended so Chinese text renders correctly in Excel.)
- **No schema changes.** No new tables, columns, or migrations.
- **All money is integer cents** (`number` in TS, `bigint` in Postgres) — never floats. Display via `formatRM`/`MoneyText`; CSV amounts via `centsToDecimal` (cents → `"1234.56"`).
- **Household scoping is mandatory.** Every Supabase read goes through the **anon** `createClient()` from `@/lib/supabase/server` and filters by `householdId` from `getMembership()` (`src/lib/data/household.ts`). **Never** use the admin/service-role client here.
- **Pure logic lives in `-shared.ts`** (no `@/lib/supabase/*`, no `next/headers`) so client/server/tests can import it freely. Server modules re-export for convenience.
- **i18n:** every user-facing string uses `t(locale, key)` and **every new key is added to BOTH the `en` and `zh` maps** in `src/i18n/dictionaries.ts`. Server Components import `t` from `@/i18n`; the report screen is server-rendered so it uses `t(locale, key)` (not the `useT()` hook).
- **Touch targets** ≥ `min-h-[44px]`; interactive elements use the `pressable`/`pressable-opacity` classes and CSS-variable colors (`var(--primary)`, `var(--subtle)`, etc.); icons from `lucide-react`.
- **Tests:** vitest, colocated `*.test.ts` beside the code; `@/` maps to `src/`. Run `npm test` (one-shot), `npm run lint`, `npm run build` before completion.

---

## File Structure

**Create:**
- `src/lib/data/report-shared.ts` — pure aggregation: category×month matrix, month totals, per-member balance trend. Framework-free.
- `src/lib/data/report-shared.test.ts` — unit tests for the above.
- `src/lib/data/csv-shared.ts` — pure CSV serialization: `centsToDecimal`, `csvField`, `toCsv`. Framework-free.
- `src/lib/data/csv-shared.test.ts` — unit tests for the above.
- `src/lib/data/report.ts` — server data layer: `getExpensesForYear`, `getLedgerForYear`, `getReportYears`, `getYearReport`. Anon client, household-scoped.
- `src/app/(app)/report/page.tsx` — server page: parses `?y=` year, fetches, renders `ReportView`.
- `src/app/(app)/report/ReportView.tsx` — server presentational component (no `'use client'`).
- `src/app/(app)/report/MonthBars.tsx` — pure server presentational 12-bar CSS chart.
- `src/app/(app)/report/export/route.ts` — Route Handler streaming CSV downloads.

**Modify:**
- `src/i18n/dictionaries.ts` — add `report.*` and `home.yearOverview*` keys to both `en` and `zh`.
- `src/app/(app)/page.tsx` — add a Home entry card linking to `/report`.

**Route decision (justification):** The bottom tab bar is fixed at five tabs (`home/expenses/fund/budget/assets`, `src/components/nav/BottomTabBar.tsx`) and adding a sixth would crowd a 430px phone. The report is a low-frequency, read-only "zoom out" view, so it lives at an **unlinked `/report` route** reached from a Home entry card (mirroring the existing "Personal ledgers" card). Placing it under the `(app)` route group gives it the phone-width shell automatically; the bottom bar simply shows no active tab there (acceptable — the Settings screen at `/settings` is likewise off-tab). The export Route Handler sits at `report/export/route.ts`; a `route.ts` and a `page.tsx` may not share the same segment, so `export/` is a child segment (Route Handlers are unaffected by the parent `layout.tsx`).

---

## Task 1: Pure CSV serialization helpers (`csv-shared.ts`)

**Files:**
- Create: `src/lib/data/csv-shared.ts`
- Test: `src/lib/data/csv-shared.test.ts`

**Interfaces:**
- Consumes: nothing (pure, no imports).
- Produces:
  - `centsToDecimal(cents: number): string` — integer cents → fixed-2-decimal string, e.g. `123456 → "1234.56"`, `-1230 → "-12.30"`, `5 → "0.05"`, `0 → "0.00"`.
  - `csvField(value: string | number | null | undefined): string` — escapes one field: `null`/`undefined` → `""`; values containing `"` `,` CR or LF are wrapped in double quotes with internal quotes doubled; everything else returned as-is.
  - `toCsv(headers: string[], rows: (string | number | null)[][]): string` — joins header + rows with `\r\n`, each cell via `csvField`, cells joined with `,`. (Callers prepend the UTF-8 BOM at the HTTP layer, not here.)

- [ ] **Step 1: Write the failing test**

Create `src/lib/data/csv-shared.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { centsToDecimal, csvField, toCsv } from './csv-shared'

describe('centsToDecimal', () => {
  it('formats positive cents with two decimals', () => {
    expect(centsToDecimal(123456)).toBe('1234.56')
    expect(centsToDecimal(5)).toBe('0.05')
    expect(centsToDecimal(0)).toBe('0.00')
  })
  it('formats negative cents', () => {
    expect(centsToDecimal(-1230)).toBe('-12.30')
    expect(centsToDecimal(-5)).toBe('-0.05')
  })
})

describe('csvField', () => {
  it('passes plain values through', () => {
    expect(csvField('hello')).toBe('hello')
    expect(csvField(1234)).toBe('1234')
  })
  it('renders null/undefined as empty', () => {
    expect(csvField(null)).toBe('')
    expect(csvField(undefined)).toBe('')
  })
  it('quotes fields with commas, quotes or newlines', () => {
    expect(csvField('a,b')).toBe('"a,b"')
    expect(csvField('line1\nline2')).toBe('"line1\nline2"')
    expect(csvField('he said "hi"')).toBe('"he said ""hi"""')
  })
})

describe('toCsv', () => {
  it('joins header and rows with CRLF and escapes cells', () => {
    const csv = toCsv(
      ['Date', 'Vendor', 'Amount'],
      [
        ['2026-01-02', 'Cafe, Co', '12.50'],
        ['2026-01-03', 'Shop', '3.00'],
      ],
    )
    expect(csv).toBe(
      'Date,Vendor,Amount\r\n2026-01-02,"Cafe, Co",12.50\r\n2026-01-03,Shop,3.00',
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/data/csv-shared.test.ts`
Expected: FAIL — cannot resolve `./csv-shared` / functions not defined.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/data/csv-shared.ts`:

```ts
// Pure, framework-free CSV serialization helpers — no supabase / next/headers here,
// so the export Route Handler, client code, and vitest can all import them.

/** Integer cents → fixed two-decimal string (RFC-4180-friendly numeric field). */
export function centsToDecimal(cents: number): string {
  const s = (Math.abs(cents) / 100).toFixed(2)
  return cents < 0 ? '-' + s : s
}

/** Escape a single CSV field per RFC 4180. null/undefined become the empty string. */
export function csvField(value: string | number | null | undefined): string {
  if (value == null) return ''
  const s = String(value)
  if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
  return s
}

/** Build a CSV document (no trailing newline, no BOM) from a header row and data rows. */
export function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  return [headers, ...rows].map((row) => row.map(csvField).join(',')).join('\r\n')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/data/csv-shared.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/csv-shared.ts src/lib/data/csv-shared.test.ts
git commit -m "feat(report): pure CSV serialization helpers"
```

---

## Task 2: Pure report aggregation (`report-shared.ts`)

**Files:**
- Create: `src/lib/data/report-shared.ts`
- Test: `src/lib/data/report-shared.test.ts`

**Interfaces:**
- Consumes:
  - `CATEGORIES` from `@/lib/categories` (each `{ key, en, zh, icon, tint }`; `key` is a `CategoryKey` string).
  - `ExpenseRow` from `./types` (`{ id, date, vendor, location, details, category, amount_cents, paid_by }`; `date` is ISO `YYYY-MM-DD`, `category` is `string | null`).
  - `LedgerEntry` from `./personal-shared` (`{ id, ownerMemberCode, period, entryType, description, amountCents, remark }`; `period` is ISO `YYYY-MM-01`).
- Produces:
  - `type CategoryMonthMatrix = { categories: string[]; cells: Record<string, number[]>; categoryTotals: Record<string, number>; monthTotals: number[]; grandTotalCents: number }` — `cells[key]` and `monthTotals` are length-12 arrays (Jan..Dec) of cents; `categories` lists only keys with data, ordered by `CATEGORIES` order with `'uncategorized'` last.
  - `buildCategoryMonthMatrix(rows: ExpenseRow[], year: number): CategoryMonthMatrix` — buckets a year's expenses by category and month (rows outside `year` ignored; `null` category → `'uncategorized'`).
  - `personalBalanceTrend(entries: LedgerEntry[], year: number): number[]` — length-12 array of monthly `income − expense` cents (entries outside `year` ignored).

- [ ] **Step 1: Write the failing test**

Create `src/lib/data/report-shared.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildCategoryMonthMatrix, personalBalanceTrend } from './report-shared'
import type { ExpenseRow } from './types'
import type { LedgerEntry } from './personal-shared'

const exp = (date: string, category: string | null, cents: number): ExpenseRow => ({
  id: 'x', date, vendor: null, location: null, details: null,
  category, amount_cents: cents, paid_by: null,
})

describe('buildCategoryMonthMatrix', () => {
  it('buckets expenses by category and month', () => {
    const m = buildCategoryMonthMatrix(
      [exp('2026-01-05', 'food', 1000), exp('2026-01-20', 'food', 500), exp('2026-03-10', 'transport', 2000)],
      2026,
    )
    expect(m.cells.food[0]).toBe(1500) // January
    expect(m.cells.food[2]).toBe(0)
    expect(m.cells.transport[2]).toBe(2000) // March
    expect(m.categoryTotals.food).toBe(1500)
    expect(m.monthTotals[0]).toBe(1500)
    expect(m.monthTotals[2]).toBe(2000)
    expect(m.grandTotalCents).toBe(3500)
  })

  it('ignores other years and maps null category to uncategorized, ordered last', () => {
    const m = buildCategoryMonthMatrix(
      [exp('2025-01-05', 'food', 9999), exp('2026-02-05', null, 700), exp('2026-02-06', 'food', 300)],
      2026,
    )
    expect(m.cells.food[1]).toBe(300)
    expect(m.cells.uncategorized[1]).toBe(700)
    expect(m.categories).toEqual(['food', 'uncategorized'])
    expect(m.grandTotalCents).toBe(1000)
  })

  it('returns empty structures when no rows match', () => {
    const m = buildCategoryMonthMatrix([], 2026)
    expect(m.categories).toEqual([])
    expect(m.monthTotals).toEqual(Array(12).fill(0))
    expect(m.grandTotalCents).toBe(0)
  })
})

describe('personalBalanceTrend', () => {
  const led = (period: string, entryType: 'income' | 'expense', cents: number): LedgerEntry => ({
    id: 'x', ownerMemberCode: 'CH', period, entryType, description: 'd', amountCents: cents, remark: null,
  })
  it('computes monthly income minus expense, ignoring other years', () => {
    const trend = personalBalanceTrend(
      [led('2026-01-01', 'income', 5000), led('2026-01-01', 'expense', 2000), led('2025-01-01', 'income', 9999)],
      2026,
    )
    expect(trend[0]).toBe(3000)
    expect(trend[1]).toBe(0)
    expect(trend.length).toBe(12)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/data/report-shared.test.ts`
Expected: FAIL — cannot resolve `./report-shared`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/data/report-shared.ts`:

```ts
// Pure, server/client-safe report aggregation — no supabase / next/headers here.
// Client components, the export route, and vitest all import these directly.
import { CATEGORIES } from '@/lib/categories'
import type { ExpenseRow } from './types'
import type { LedgerEntry } from './personal-shared'

export type CategoryMonthMatrix = {
  categories: string[]
  cells: Record<string, number[]>
  categoryTotals: Record<string, number>
  monthTotals: number[]
  grandTotalCents: number
}

/** Category ordering for the matrix: defined categories first, 'uncategorized' last. */
const CATEGORY_ORDER: string[] = [...CATEGORIES.map((c) => c.key as string), 'uncategorized']

export function buildCategoryMonthMatrix(rows: ExpenseRow[], year: number): CategoryMonthMatrix {
  const yearStr = String(year)
  const cells: Record<string, number[]> = {}
  for (const r of rows) {
    if (r.date.slice(0, 4) !== yearStr) continue
    const monthIndex = Number(r.date.slice(5, 7)) - 1
    if (monthIndex < 0 || monthIndex > 11) continue
    const key = r.category ?? 'uncategorized'
    ;(cells[key] ??= Array(12).fill(0))[monthIndex] += r.amount_cents
  }

  const categories = CATEGORY_ORDER.filter((k) => k in cells)
  const categoryTotals: Record<string, number> = {}
  const monthTotals = Array(12).fill(0)
  for (const key of categories) {
    const row = cells[key]
    categoryTotals[key] = row.reduce((a, b) => a + b, 0)
    for (let i = 0; i < 12; i++) monthTotals[i] += row[i]
  }
  const grandTotalCents = monthTotals.reduce((a, b) => a + b, 0)

  return { categories, cells, categoryTotals, monthTotals, grandTotalCents }
}

export function personalBalanceTrend(entries: LedgerEntry[], year: number): number[] {
  const yearStr = String(year)
  const trend = Array(12).fill(0)
  for (const e of entries) {
    if (e.period.slice(0, 4) !== yearStr) continue
    const monthIndex = Number(e.period.slice(5, 7)) - 1
    if (monthIndex < 0 || monthIndex > 11) continue
    trend[monthIndex] += e.entryType === 'income' ? e.amountCents : -e.amountCents
  }
  return trend
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/data/report-shared.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/report-shared.ts src/lib/data/report-shared.test.ts
git commit -m "feat(report): pure year-report aggregation helpers"
```

---

## Task 3: Server data layer (`report.ts`)

**Files:**
- Create: `src/lib/data/report.ts`
- Reference (do not edit): `src/lib/data/expenses.ts:12-26` (`COLS`, `listExpenses` pattern), `src/lib/data/personal.ts:11-23` (`mapEntry`), `src/lib/data/summary.ts:5-11` (`monthRange`), `src/lib/data/fund.ts:13-48` (`getFundOverview`), `src/lib/data/household.ts` (`getMembership`).

**Interfaces:**
- Consumes:
  - `createClient` from `@/lib/supabase/server`, `getMembership` from `./household`, `monthRange(year, month1to12): { startISO, endISO }` from `./summary`.
  - `getFundOverview(year): Promise<FundOverview>` from `./fund`; `FundOverview` from `./fund-shared`.
  - `buildCategoryMonthMatrix`, `personalBalanceTrend`, `CategoryMonthMatrix` from `./report-shared`.
  - `ExpenseRow`, `Member` from `./types`; `LedgerEntry` from `./personal-shared`.
- Produces:
  - `getExpensesForYear(year: number): Promise<ExpenseRow[]>` — all household expenses dated within `year`, newest first.
  - `getLedgerForYear(member: Member, year: number): Promise<LedgerEntry[]>` — one member's ledger entries with `period` in `year`.
  - `getReportYears(): Promise<number[]>` — descending distinct years that have expense or ledger data, always including the current year.
  - `type YearReport = { year: number; matrix: CategoryMonthMatrix; fund: FundOverview; personalTrend: { CH: number[]; JC: number[] }; availableYears: number[] }`.
  - `getYearReport(year: number): Promise<YearReport>`.

- [ ] **Step 1: Write the implementation**

> This is a thin server module over already-tested pure helpers and existing query patterns, so it carries no new unit test (matching `fund.ts`/`personal.ts`, whose Supabase reads are also not unit-tested). Its correctness is exercised at build time and by the screen/route in later tasks.

Create `src/lib/data/report.ts`:

```ts
import { createClient } from '@/lib/supabase/server'
import { getMembership } from './household'
import { monthRange } from './summary'
import { getFundOverview } from './fund'
import type { FundOverview } from './fund-shared'
import { buildCategoryMonthMatrix, personalBalanceTrend, type CategoryMonthMatrix } from './report-shared'
import type { ExpenseRow, Member } from './types'
import type { LedgerEntry } from './personal-shared'

// Re-export the pure helpers for convenience (client code should still prefer ./report-shared).
export { buildCategoryMonthMatrix, personalBalanceTrend }
export type { CategoryMonthMatrix }

const EXPENSE_COLS = 'id, date, vendor, location, details, category, amount_cents, paid_by'
const LEDGER_COLS = 'id, owner_member_code, period, entry_type, description, amount_cents, remark'

function mapLedger(r: Record<string, unknown>): LedgerEntry {
  return {
    id: r.id as string,
    ownerMemberCode: r.owner_member_code as Member,
    period: r.period as string,
    entryType: r.entry_type as 'income' | 'expense',
    description: r.description as string,
    amountCents: r.amount_cents as number,
    remark: (r.remark as string | null) ?? null,
  }
}

export async function getExpensesForYear(year: number): Promise<ExpenseRow[]> {
  const m = await getMembership()
  if (!m) return []
  const supabase = await createClient()
  const { startISO } = monthRange(year, 1)
  const { startISO: nextYearStart } = monthRange(year + 1, 1)
  const { data, error } = await supabase
    .from('expenses').select(EXPENSE_COLS)
    .eq('household_id', m.householdId)
    .gte('date', startISO).lt('date', nextYearStart)
    .order('date', { ascending: false })
  if (error) { console.error('getExpensesForYear failed:', error.message); return [] }
  return (data ?? []) as ExpenseRow[]
}

export async function getLedgerForYear(member: Member, year: number): Promise<LedgerEntry[]> {
  const m = await getMembership()
  if (!m) return []
  const supabase = await createClient()
  const { startISO } = monthRange(year, 1)
  const { startISO: nextYearStart } = monthRange(year + 1, 1)
  const { data, error } = await supabase
    .from('ledger_entries').select(LEDGER_COLS)
    .eq('household_id', m.householdId)
    .eq('owner_member_code', member)
    .gte('period', startISO).lt('period', nextYearStart)
    .order('period', { ascending: true })
  if (error) { console.error('getLedgerForYear failed:', error.message); return [] }
  return (data ?? []).map(mapLedger)
}

export async function getReportYears(): Promise<number[]> {
  const currentYear = new Date().getFullYear()
  const m = await getMembership()
  if (!m) return [currentYear]
  const supabase = await createClient()
  const [expRes, ledRes] = await Promise.all([
    supabase.from('expenses').select('date').eq('household_id', m.householdId),
    supabase.from('ledger_entries').select('period').eq('household_id', m.householdId),
  ])
  if (expRes.error) console.error('getReportYears expenses:', expRes.error.message)
  if (ledRes.error) console.error('getReportYears ledger:', ledRes.error.message)
  const years = new Set<number>([currentYear])
  for (const r of (expRes.data ?? []) as { date: string }[]) years.add(Number(r.date.slice(0, 4)))
  for (const r of (ledRes.data ?? []) as { period: string }[]) years.add(Number(r.period.slice(0, 4)))
  return [...years].filter((y) => Number.isInteger(y)).sort((a, b) => b - a)
}

export type YearReport = {
  year: number
  matrix: CategoryMonthMatrix
  fund: FundOverview
  personalTrend: { CH: number[]; JC: number[] }
  availableYears: number[]
}

export async function getYearReport(year: number): Promise<YearReport> {
  const [expenses, chLedger, jcLedger, fund, availableYears] = await Promise.all([
    getExpensesForYear(year),
    getLedgerForYear('CH', year),
    getLedgerForYear('JC', year),
    getFundOverview(year),
    getReportYears(),
  ])
  return {
    year,
    matrix: buildCategoryMonthMatrix(expenses, year),
    fund,
    personalTrend: {
      CH: personalBalanceTrend(chLedger, year),
      JC: personalBalanceTrend(jcLedger, year),
    },
    availableYears,
  }
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: no errors involving `src/lib/data/report.ts`. (If the repo has no `tsc` script, `npm run build` in Task 6 covers this; a quick `npx tsc --noEmit` here catches typos early.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/report.ts
git commit -m "feat(report): year-report server data layer"
```

---

## Task 4: Year Overview screen (page + ReportView + MonthBars) & i18n

**Files:**
- Create: `src/app/(app)/report/MonthBars.tsx`
- Create: `src/app/(app)/report/ReportView.tsx`
- Create: `src/app/(app)/report/page.tsx`
- Modify: `src/i18n/dictionaries.ts` (add keys to both `en` and `zh`)
- Reference: `src/app/(app)/fund/FundView.tsx` (HeroCard/Card layout), `src/app/(app)/budget/BudgetBars.tsx` (CSS bar pattern), `src/app/(app)/expenses/page.tsx:4-15` (searchParams year-parse pattern), `src/lib/categories.ts` (`categoryLabel`).

**Interfaces:**
- Consumes: `getYearReport`, `YearReport` from `@/lib/data/report`; `getMembership` from `@/lib/data/household`; `t` from `@/i18n`; `formatMonthYear`/`monthShort` from `@/lib/data/summary`; `categoryLabel` from `@/lib/categories`; `Card`, `HeroCard` from `@/components/ui/Card`; `MoneyText` from `@/components/ui/MoneyText`; `ProgressBar` from `@/components/ui/ProgressBar`; `MemberAvatar` from `@/components/ui/MemberAvatar`.
- Produces: `MonthBars` component (`{ values: number[]; maxValue: number; locale: 'en' | 'zh'; signed?: boolean }`); `ReportView` server component (`{ report: YearReport; locale: 'en' | 'zh' }`); the `/report` route.

- [ ] **Step 1: Add i18n keys (both languages)**

In `src/i18n/dictionaries.ts`, add these entries inside the `en` map (e.g. just before `'test.only_en'` at line 189):

```ts
    'report.title': 'Year Overview',
    'report.spendingByMonth': 'Spending by month',
    'report.byCategory': 'By category',
    'report.fundSummary': 'Joint fund',
    'report.personalBalance': 'Personal balance',
    'report.total': 'Total',
    'report.ofYear': 'of year target',
    'report.carryForward': 'Carry-forward',
    'report.noData': 'No data for this year yet',
    'report.export': 'Export',
    'report.exportNote': 'CSV files open in Excel and Google Sheets.',
    'report.downloadExpenses': 'Expenses',
    'report.downloadLedger': 'Ledger',
    'home.yearOverview': 'Year overview',
    'home.yearOverview.subtitle': 'Reports & export',
```

And add the matching entries inside the `zh` map (e.g. just before `'test.only_en': '英文'` — verify the exact preceding key; append before the closing `}` of the `zh` map if unsure):

```ts
    'report.title': '年度总览',
    'report.spendingByMonth': '每月支出',
    'report.byCategory': '按类别',
    'report.fundSummary': '共同基金',
    'report.personalBalance': '个人结余',
    'report.total': '合计',
    'report.ofYear': '全年目标',
    'report.carryForward': '结转',
    'report.noData': '本年暂无数据',
    'report.export': '导出',
    'report.exportNote': 'CSV 文件可用 Excel 或 Google 表格打开。',
    'report.downloadExpenses': '开支',
    'report.downloadLedger': '账本',
    'home.yearOverview': '年度总览',
    'home.yearOverview.subtitle': '报表与导出',
```

> Note: `t()` falls back to `en` for any missing key, but this plan requires every key in both maps — do not rely on the fallback.

- [ ] **Step 2: Create the MonthBars chart component**

Create `src/app/(app)/report/MonthBars.tsx`:

```tsx
import { monthShort } from '@/lib/data/summary'

/**
 * A compact 12-column CSS bar chart (Jan..Dec). Heights scale to `maxValue`.
 * When `signed`, negative values render in danger red below/above using the same
 * up-from-baseline layout (magnitude only) — the caller pairs it with numeric
 * labels for sign clarity. Pure presentational Server Component; no chart lib.
 */
export function MonthBars({
  values,
  maxValue,
  locale,
  signed = false,
}: {
  values: number[]
  maxValue: number
  locale: 'en' | 'zh'
  signed?: boolean
}) {
  return (
    <div className="flex items-end gap-[3px]" role="img" aria-hidden="true">
      {values.map((v, i) => {
        const pct = maxValue > 0 ? Math.round((Math.abs(v) / maxValue) * 100) : 0
        const bg = signed && v < 0 ? 'var(--danger)' : 'var(--primary)'
        return (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-16 w-full items-end">
              <div
                className="w-full rounded-[3px]"
                style={{ height: `${pct}%`, minHeight: v !== 0 ? 2 : 0, background: bg }}
              />
            </div>
            <span className="text-[9px] font-semibold text-[var(--faint)]">
              {monthShort(i + 1, locale).replace('月', '')}
            </span>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Create the ReportView presentational component**

Create `src/app/(app)/report/ReportView.tsx`:

```tsx
import Link from 'next/link'
import { ChevronLeft, Download } from 'lucide-react'
import { t } from '@/i18n'
import { categoryLabel } from '@/lib/categories'
import type { YearReport } from '@/lib/data/report'
import { Card, HeroCard } from '@/components/ui/Card'
import { MoneyText } from '@/components/ui/MoneyText'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { MemberAvatar } from '@/components/ui/MemberAvatar'
import { MonthBars } from './MonthBars'

type Locale = 'en' | 'zh'

export function ReportView({ report, locale }: { report: YearReport; locale: Locale }) {
  const { year, matrix, fund, personalTrend, availableYears } = report
  const fundProgress = fund.yearExpectedCents > 0 ? fund.yearContributedCents / fund.yearExpectedCents : 0
  const monthMax = Math.max(0, ...matrix.monthTotals)
  const trendMax = Math.max(
    0,
    ...personalTrend.CH.map((v) => Math.abs(v)),
    ...personalTrend.JC.map((v) => Math.abs(v)),
  )
  const hasData = matrix.grandTotalCents > 0 || fund.yearContributedCents > 0
  const exportHref = (params: string) => `/report/export?${params}`

  return (
    <div className="flex flex-col gap-5 pb-6">
      <header className="flex items-center gap-1">
        <Link
          href="/"
          aria-label={t(locale, 'common.back')}
          className="pressable-opacity -ml-2 grid h-11 w-11 place-items-center text-[var(--muted)]"
        >
          <ChevronLeft size={24} />
        </Link>
        <h1 className="text-2xl font-extrabold text-[var(--ink-head)]">{t(locale, 'report.title')}</h1>
      </header>

      {/* Year selector — plain links, no client JS */}
      <div className="flex flex-wrap gap-2">
        {availableYears.map((y) => {
          const active = y === year
          return (
            <Link
              key={y}
              href={`/report?y=${y}`}
              className="pressable-opacity min-h-11 rounded-full px-4 py-2 text-sm font-bold"
              style={{
                background: active ? 'var(--primary)' : 'var(--subtle)',
                color: active ? 'white' : 'var(--muted)',
              }}
            >
              {y}
            </Link>
          )
        })}
      </div>

      {!hasData && (
        <Card>
          <p className="text-sm font-semibold text-[var(--muted)]">{t(locale, 'report.noData')}</p>
        </Card>
      )}

      {/* Joint fund year summary */}
      <HeroCard>
        <span className="text-sm font-bold opacity-90">{t(locale, 'report.fundSummary')}</span>
        <div className="mt-1">
          <MoneyText cents={fund.yearContributedCents} className="text-[32px] font-extrabold" />
        </div>
        <p className="mt-1 flex items-center gap-1 text-sm font-semibold opacity-80">
          <MoneyText cents={fund.yearExpectedCents} /> {t(locale, 'report.ofYear')}
        </p>
        <div className="mt-3">
          <ProgressBar value={fundProgress} trackClassName="bg-white/25" barClassName="bg-white" />
        </div>
        <div className="mt-4 flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold whitespace-nowrap">
          <span>{t(locale, 'report.carryForward')}</span>
          <span>·</span>
          <MoneyText cents={fund.carryForwardCents} />
        </div>
      </HeroCard>

      {/* Spending by month */}
      <Card>
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-[var(--ink-head)]">{t(locale, 'report.spendingByMonth')}</span>
          <MoneyText cents={matrix.grandTotalCents} className="text-sm font-bold text-[var(--ink-head)]" />
        </div>
        <div className="mt-3">
          <MonthBars values={matrix.monthTotals} maxValue={monthMax} locale={locale} />
        </div>
      </Card>

      {/* By category */}
      <Card>
        <span className="text-sm font-bold text-[var(--ink-head)]">{t(locale, 'report.byCategory')}</span>
        {matrix.categories.length === 0 ? (
          <p className="mt-2 text-sm font-semibold text-[var(--muted)]">{t(locale, 'report.noData')}</p>
        ) : (
          <div className="mt-3 flex flex-col gap-4">
            {matrix.categories.map((key) => (
              <div key={key} className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold text-[var(--ink)]">{categoryLabel(key, locale)}</span>
                  <MoneyText cents={matrix.categoryTotals[key]} className="font-bold text-[var(--ink-head)]" />
                </div>
                <MonthBars values={matrix.cells[key]} maxValue={monthMax} locale={locale} />
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Personal balance trend per member */}
      <Card>
        <span className="text-sm font-bold text-[var(--ink-head)]">{t(locale, 'report.personalBalance')}</span>
        <div className="mt-3 flex flex-col gap-5">
          {(['CH', 'JC'] as const).map((member) => (
            <div key={member} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <MemberAvatar member={member} size={24} />
                <span className="text-sm font-bold text-[var(--ink)]">{member}</span>
              </div>
              <MonthBars values={personalTrend[member]} maxValue={trendMax} locale={locale} signed />
            </div>
          ))}
        </div>
      </Card>

      {/* Export (per domain) */}
      <Card>
        <div className="flex items-center gap-2">
          <Download size={16} className="text-[var(--muted)]" />
          <span className="text-sm font-bold text-[var(--ink-head)]">{t(locale, 'report.export')}</span>
        </div>
        <p className="mt-1 text-xs font-semibold text-[var(--muted)]">{t(locale, 'report.exportNote')}</p>
        <div className="mt-3 flex flex-col gap-2">
          <ExportLink href={exportHref(`type=expenses&year=${year}`)} label={`${t(locale, 'report.downloadExpenses')} · ${year}`} />
          <ExportLink href={exportHref(`type=ledger&year=${year}&member=CH`)} label={`${t(locale, 'report.downloadLedger')} · CH ${year}`} />
          <ExportLink href={exportHref(`type=ledger&year=${year}&member=JC`)} label={`${t(locale, 'report.downloadLedger')} · JC ${year}`} />
        </div>
      </Card>
    </div>
  )
}

function ExportLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      download
      className="pressable flex min-h-[44px] items-center justify-between gap-2 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-2.5 text-sm font-bold text-[var(--ink)]"
    >
      <span>{label}</span>
      <Download size={16} className="text-[var(--muted)]" />
    </a>
  )
}
```

> Asset-transaction export is intentionally **not** listed here: assets are not year-scoped and the natural per-asset download belongs on the asset detail screen. Task 5 implements the `type=asset&assetId=…` branch of the export route so that a future asset-detail download button (or a manual link) works; wiring a button into the asset screen is out of this plan's scope (it would need `assets` UI edits already covered by Phase 7). The route capability is built now to satisfy the spec's "asset transactions (per asset)" export requirement.

- [ ] **Step 4: Create the page**

Create `src/app/(app)/report/page.tsx`:

```tsx
import { getYearReport } from '@/lib/data/report'
import { getMembership } from '@/lib/data/household'
import { ReportView } from './ReportView'

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string }>
}) {
  const { y } = await searchParams
  const now = new Date()
  const parsedYear = Number(y)
  const year =
    Number.isInteger(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100 ? parsedYear : now.getFullYear()

  const [membership, report] = await Promise.all([getMembership(), getYearReport(year)])
  const locale = membership?.language ?? 'en'

  return <ReportView report={report} locale={locale} />
}
```

- [ ] **Step 5: Verify build/typecheck of the new screen**

Run: `npx tsc --noEmit`
Expected: no errors. Then run `npm run lint` and confirm no new lint errors in `src/app/(app)/report/*`.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/report/MonthBars.tsx" "src/app/(app)/report/ReportView.tsx" "src/app/(app)/report/page.tsx" src/i18n/dictionaries.ts
git commit -m "feat(report): year overview screen with month/category/balance charts"
```

---

## Task 5: CSV export Route Handler

**Files:**
- Create: `src/app/(app)/report/export/route.ts`
- Reference: `src/app/api/reminders/run/route.ts` (existing Route Handler shape), `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` (GET handler + `NextRequest`), `src/lib/data/assets.ts:50-62` (`getAsset` shape).

**Interfaces:**
- Consumes: `getMembership` from `@/lib/data/household`; `getExpensesForYear`, `getLedgerForYear` from `@/lib/data/report`; `getAsset` from `@/lib/data/assets`; `toCsv`, `centsToDecimal` from `@/lib/data/csv-shared`; `categoryLabel` from `@/lib/categories`.
- Produces: `GET(request: NextRequest)` responding with `text/csv` (UTF-8 BOM prefixed) and a `Content-Disposition: attachment` filename. Supported query shapes:
  - `?type=expenses&year=2026` → columns Date, Vendor, Location, Details, Category, Amount, Paid By.
  - `?type=ledger&year=2026&member=CH|JC` → columns Month, Type, Description, Amount, Remark.
  - `?type=asset&assetId=<uuid>` → columns Date, Description, Txn Type, Direction, Amount, Settled, Notes.
  - Missing session → 401; invalid/unknown params → 400.

- [ ] **Step 1: Write the implementation**

Create `src/app/(app)/report/export/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { getMembership } from '@/lib/data/household'
import { getExpensesForYear, getLedgerForYear } from '@/lib/data/report'
import { getAsset } from '@/lib/data/assets'
import { toCsv, centsToDecimal } from '@/lib/data/csv-shared'
import { categoryLabel } from '@/lib/categories'

// Export CSVs are always request-time, per-user (RLS-scoped) — never cache.
export const dynamic = 'force-dynamic'

/** UTF-8 BOM so Excel detects the encoding and renders Chinese text correctly. */
function csvResponse(filename: string, csv: string): NextResponse {
  return new NextResponse('﻿' + csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

function parseYear(raw: string | null): number | null {
  const y = Number(raw)
  return Number.isInteger(y) && y >= 2000 && y <= 2100 ? y : null
}

export async function GET(request: NextRequest) {
  const m = await getMembership()
  if (!m) return NextResponse.json({ ok: false, error: 'not_authenticated' }, { status: 401 })

  const sp = request.nextUrl.searchParams
  const type = sp.get('type')

  if (type === 'expenses') {
    const year = parseYear(sp.get('year'))
    if (year == null) return NextResponse.json({ ok: false, error: 'invalid_year' }, { status: 400 })
    const rows = await getExpensesForYear(year)
    const csv = toCsv(
      ['Date', 'Vendor', 'Location', 'Details', 'Category', 'Amount', 'Paid By'],
      rows.map((r) => [
        r.date,
        r.vendor,
        r.location,
        r.details,
        r.category ? categoryLabel(r.category, 'en') : '',
        centsToDecimal(r.amount_cents),
        r.paid_by,
      ]),
    )
    return csvResponse(`kita-expenses-${year}.csv`, csv)
  }

  if (type === 'ledger') {
    const year = parseYear(sp.get('year'))
    const member = sp.get('member')
    if (year == null) return NextResponse.json({ ok: false, error: 'invalid_year' }, { status: 400 })
    if (member !== 'CH' && member !== 'JC') {
      return NextResponse.json({ ok: false, error: 'invalid_member' }, { status: 400 })
    }
    const rows = await getLedgerForYear(member, year)
    const csv = toCsv(
      ['Month', 'Type', 'Description', 'Amount', 'Remark'],
      rows.map((e) => [
        e.period.slice(0, 7),
        e.entryType,
        e.description,
        centsToDecimal(e.amountCents),
        e.remark,
      ]),
    )
    return csvResponse(`kita-ledger-${member}-${year}.csv`, csv)
  }

  if (type === 'asset') {
    const assetId = sp.get('assetId')
    if (!assetId) return NextResponse.json({ ok: false, error: 'invalid_asset' }, { status: 400 })
    const result = await getAsset(assetId)
    if (!result) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
    const csv = toCsv(
      ['Date', 'Description', 'Txn Type', 'Direction', 'Amount', 'Settled', 'Notes'],
      result.txns.map((t) => [
        t.date,
        t.description,
        t.txnType,
        t.direction,
        centsToDecimal(t.amountCents),
        t.settled ? 'yes' : 'no',
        t.notes,
      ]),
    )
    const safeName = result.asset.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    return csvResponse(`kita-asset-${safeName}.csv`, csv)
  }

  return NextResponse.json({ ok: false, error: 'invalid_type' }, { status: 400 })
}
```

- [ ] **Step 2: Verify build/typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. Confirm `getAsset` returns `{ asset, txns }` (see `src/lib/data/assets.ts:50`) and `AssetTxn` has `txnType`/`settled`/`notes` (see `src/lib/data/assets-shared.ts:5-8`) — the code above matches those shapes.

- [ ] **Step 3: Manual smoke test of the export route**

Run: `npm run dev`, sign in, then in the browser visit:
- `http://localhost:3000/report/export?type=expenses&year=2026` — a `kita-expenses-2026.csv` download begins; opening it shows a header row + expense rows with a `1234.56`-style Amount column.
- `http://localhost:3000/report/export?type=ledger&year=2026&member=CH` — downloads `kita-ledger-CH-2026.csv`.
- `http://localhost:3000/report/export?type=expenses` (no year) — returns HTTP 400 JSON `{ ok:false, error:"invalid_year" }`.

Expected: downloads succeed with correct `Content-Disposition` filenames; the invalid case returns 400. (RLS guarantees rows belong to the signed-in household — the route uses only the anon client via `getMembership`.)

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/report/export/route.ts"
git commit -m "feat(report): CSV export route for expenses, ledger, and asset transactions"
```

---

## Task 6: Home entry point + full verification

**Files:**
- Modify: `src/app/(app)/page.tsx` (add a `/report` entry card after the "Personal ledgers" card, ~line 113)
- Reference: existing "Personal ledgers" card at `src/app/(app)/page.tsx:100-113`.

**Interfaces:**
- Consumes: `Link` from `next/link` (already imported at `src/app/(app)/page.tsx:1`), `Card` (already imported), `t` (already imported), `home.yearOverview` / `home.yearOverview.subtitle` keys (added in Task 4).

- [ ] **Step 1: Add the Home entry card**

In `src/app/(app)/page.tsx`, add the following block immediately after the closing `</Link>` of the "Personal ledgers" card (after line 113), before the "Upcoming" `<Card>`:

```tsx
      <Link href="/report">
        <Card className="pressable flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[var(--ink-head)]">{t(locale, 'home.yearOverview')}</p>
            <p className="truncate text-xs font-semibold text-[var(--muted)]">
              {t(locale, 'home.yearOverview.subtitle')}
            </p>
          </div>
          <ChartColumn size={20} className="shrink-0 text-[var(--muted)]" />
        </Card>
      </Link>
```

- [ ] **Step 2: Import the icon**

In `src/app/(app)/page.tsx`, change the lucide import (line 2) from:

```tsx
import { SlidersHorizontal } from 'lucide-react'
```

to:

```tsx
import { SlidersHorizontal, ChartColumn } from 'lucide-react'
```

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS — all suites green, including `csv-shared.test.ts` and `report-shared.test.ts`.

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: no errors (no unused imports; `ChartColumn` is now used).

- [ ] **Step 5: Production build**

Run: `npm run build`
Expected: build succeeds; `/report` appears as a route and `/report/export` as a Route Handler in the build output.

- [ ] **Step 6: Manual end-to-end check**

Run: `npm run dev`, sign in, on Home tap the new "Year overview" card → lands on `/report`. Verify: year chips switch the year (URL gains `?y=…`, data updates); the fund/spending/category/personal-balance cards render CSS bars; each Export button downloads a CSV that opens cleanly in a spreadsheet. Toggle language in Settings and confirm the report labels switch between EN and 中文.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(app)/page.tsx"
git commit -m "feat(report): add year-overview entry card to Home"
```

---

## Self-Review

**1. Spec coverage (§3 Phase 10, items 9-10 + §4 answers):**
- Spend by category by month + year totals → Task 2 (`buildCategoryMonthMatrix`) + Task 4 (category cards with `MonthBars`, `categoryTotals`, `grandTotalCents`). ✅
- Joint fund year summary (contributed vs expected, carry-forward via `getFundOverview`) → Task 3 (`getYearReport` includes `fund`) + Task 4 HeroCard. ✅
- Personal balance trend per member (monthly income−expense) → Task 2 (`personalBalanceTrend`) + Task 4 personal-balance card. ✅
- Year selector (report scope = expenses/fund/ledger years) → Task 3 (`getReportYears`) + Task 4 year chips. ✅
- Server-rendered, pure aggregation in `-shared.ts` with TDD, integer cents → Tasks 1-4. ✅
- CSV export (expenses/year, ledger/member-year, asset-txns/asset), Route Handler, anon client + RLS, no admin client, text/csv attachment → Task 5. ✅
- Pure CSV helpers (escaping, cents→decimal) in `-shared.ts` with TDD → Task 1. ✅
- No xlsx / no new deps; CSV opens in Excel (BOM for Chinese) → Global Constraints + Task 5. ✅
- Entry points / download buttons on the overview, per domain → Task 4 export card + Task 6 Home link. ✅
- i18n keys in both en and zh → Task 4 Step 1. ✅
- No schema changes → confirmed; only reads. ✅
- §4 answer "expenses have their own category, don't link to budget" → matrix keys off `expenses.category` directly, no budget linkage. ✅

**2. Placeholder scan:** No TBD/TODO/"add error handling"/"similar to Task N". Every code step is complete. ✅

**3. Type consistency:** `CategoryMonthMatrix`, `YearReport`, `buildCategoryMonthMatrix`, `personalBalanceTrend`, `centsToDecimal`, `csvField`, `toCsv`, `getExpensesForYear`, `getLedgerForYear`, `getReportYears`, `getYearReport` are named identically across Tasks 1-5. `LedgerEntry`/`ExpenseRow`/`AssetTxn`/`FundOverview` field names match their source modules (verified against `personal-shared.ts`, `types.ts`, `assets-shared.ts`, `fund-shared.ts`). `getAsset` returns `{ asset, txns }` — matched in Task 5. `MonthBars` prop shape is consistent between definition (Task 4 Step 2) and all call sites (Task 4 Step 3). ✅

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-05-phase-10-reports.md`. Two execution options:

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
</content>
</invoke>
