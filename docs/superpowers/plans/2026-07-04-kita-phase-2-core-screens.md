# Kita — Phase 2: Core Daily Screens — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the three daily-driver screens from the Kita design handoff — Home dashboard (`1A`), Add Expense (`2A`), and Expenses list (`2B`) — wired to the Phase 1 Supabase data, and wire the EN/中文 i18n primitive into the live shell.

**Architecture:** Server Components fetch household-scoped data through a small typed data-access layer (`src/lib/data/*`); interactive pieces (keypad, filters, swipe, language) are Client Components. Pure transforms (date grouping, month ranges, summaries) are unit-tested; screens are recreated faithfully from the handoff and verified by build + manual pass. A `LocaleProvider` seeded from `profiles.language` makes `t()` available app-wide.

**Tech Stack:** Next.js 16 App Router (Server + Client Components, Server Actions) · Supabase (`@supabase/ssr`) · Tailwind v4 + Kita tokens · `lucide-react` · Vitest.

## Global Constraints

- **Currency:** always `RM 1,234.56` via `formatRM(cents)` from `@/lib/money`. Money is integer **cents** end-to-end; never render a raw cents number.
- **Add-Expense keypad:** cents accumulator using `pushDigit`/`pushDoubleZero`/`backspace` from `@/lib/money` (already tested). Blinking terracotta caret on the amount.
- **Data isolation:** every query/mutation is household-scoped. Never pass a `household_id` from the client; always derive it server-side from the authenticated user via `getMembership()`. Inserts set `household_id`, `created_by`, and `paid_by` server-side.
- **Members:** `CH` and `JC` only. Per-member accent: CH = peach/terracotta, JC = blue.
- **Design source of truth:** `design_handoff_kita/README.md` — build direction **1A**; screen specs `1A`, `2A`, `2B`. Bottom tabs Home·Expenses·Fund·Budget·Assets; Settings via Home header gear (gear target is Phase 5 — render the gear, link to `/settings` which 404s gracefully or is disabled).
- **Tokens:** use the CSS vars from `globals.css` (`--paper`, `--surface`, `--ink`, `--muted`, `--primary`, `--primary-btn`, `--positive-*`, `--pending-*`, `--info-*`, `--hero-grad`, `--member-ch`, `--member-jc`, etc.). Hero cards use `background: var(--hero-grad)`.
- **i18n:** all user-facing strings go through `t()`/`useT()`; add keys in BOTH `en` and `zh`. Locale comes from `profiles.language` (default `en`). The language *toggle UI* is Phase 5 — Phase 2 only wires reading + applying the stored preference.
- **Bilingual layout:** components must tolerate Chinese text (denser glyphs, different lengths).
- **Min tap target 44px.** Content max-width 430px, 18px horizontal padding (from the Phase 1 `(app)` layout).

---

## Data Realities (read before building)

- Seeded expenses span **2026-01 … 2026-06**; the current calendar month (July 2026) is empty until the user adds expenses. Screens anchor to a **selected month** (default = current calendar month). The **Expenses screen gets a month stepper** (‹ July 2026 ›) so imported months are browsable — a deliberate, minimal extension of the handoff (which mocked a single month). Home anchors to the current month only.
- `expenses.category` and `expenses.paid_by` are **NULL** for all seeded rows (the sheet had no per-row category/payer). New expenses added in-app WILL set them. Filters/among category UI must treat NULL as "Uncategorized"/no-payer gracefully.
- **Personal ledger balances** (`ledger_entries`) are **not seeded until Phase 4**. The Home "Personal ledgers" card renders WITHOUT numeric balances in Phase 2 (label only, not a link yet) and is wired in Phase 4.
- **Budget** metric in Phase 2 = `sum(budget_categories.total_cents)` (monthly budget) vs `sum(expenses in selected month)` (spent). Reconciling commitments vs categories is a Phase 3 (Budget screen) concern — do not attempt it here.

---

## File Structure (Phase 2)

```
src/
├─ lib/
│  ├─ categories.ts            # canonical expense categories: key, en, zh, icon, tint
│  ├─ data/
│  │  ├─ types.ts              # Membership, ExpenseRow, HomeSummary, DayGroup, ...
│  │  ├─ household.ts          # getMembership() (server)
│  │  ├─ summary.ts            # PURE: monthRange, monthKey, groupByDay, sumCents (TESTED)
│  │  ├─ summary.test.ts
│  │  ├─ expenses.ts           # listExpenses, getMonthTotalCents, addExpense, deleteExpense (server)
│  │  └─ home.ts               # getHomeSummary (server)
├─ i18n/
│  ├─ dictionaries.ts          # EXTENDED with Phase 2 keys (en+zh)
│  ├─ dictionaries.test.ts     # extended parity test
│  ├─ index.ts                 # (unchanged t())
│  └─ LocaleProvider.tsx       # client context + useT()/useLocale()
├─ components/
│  ├─ ui/
│  │  ├─ Card.tsx              # surface card + HeroCard (gradient)
│  │  ├─ ProgressBar.tsx
│  │  ├─ MemberAvatar.tsx      # CH peach / JC blue initials
│  │  ├─ IconTile.tsx          # rounded tile holding a lucide icon
│  │  ├─ StatusChip.tsx        # paid/pending/upcoming pill
│  │  ├─ MoneyText.tsx         # formatRM wrapper, tabular-nums
│  │  └─ Fab.tsx               # terracotta FAB / pill
│  └─ nav/BottomTabBar.tsx     # MODIFIED: labels via useT()
├─ app/(app)/
│  ├─ layout.tsx               # MODIFIED: server, reads membership.language -> LocaleProvider
│  ├─ page.tsx                 # Home (1A)
│  ├─ expenses/
│  │  ├─ page.tsx              # Expenses list (2B)
│  │  ├─ ExpensesView.tsx      # client: filters, month stepper, swipe rows
│  │  └─ add/
│  │     ├─ page.tsx           # Add Expense route (2A)
│  │     ├─ AddExpenseForm.tsx # client: keypad, payer, category, note
│  │     └─ actions.ts         # server action addExpense
```

---

## Task 1: Pure summary/date utilities (TDD)

**Files:**
- Create: `src/lib/data/summary.ts`, `src/lib/data/summary.test.ts`, `src/lib/data/types.ts`

**Interfaces:**
- Produces:
  - `type ExpenseRow = { id: string; date: string; vendor: string | null; details: string | null; category: string | null; amount_cents: number; paid_by: 'CH'|'JC'|null }`
  - `type DayGroup = { date: string; label: string; totalCents: number; rows: ExpenseRow[] }`
  - `monthRange(year: number, month1to12: number): { startISO: string; endISO: string }` — `[start, end)` first-of-month to first-of-next-month, `YYYY-MM-DD`.
  - `monthKey(dateISO: string): string` — `'YYYY-MM'`.
  - `sumCents(rows: { amount_cents: number }[]): number`
  - `groupByDay(rows: ExpenseRow[], todayISO: string): DayGroup[]` — newest day first; `label` is `Today` / `Yesterday` / else `Jul 3` style (English label; the caller localizes headers if needed). Rows within a day preserve input order.

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { monthRange, monthKey, sumCents, groupByDay } from './summary'
import type { ExpenseRow } from './types'

const row = (id: string, date: string, amount_cents: number): ExpenseRow =>
  ({ id, date, vendor: null, details: null, category: null, amount_cents, paid_by: null })

describe('monthRange', () => {
  it('returns [first-of-month, first-of-next-month)', () => {
    expect(monthRange(2026, 7)).toEqual({ startISO: '2026-07-01', endISO: '2026-08-01' })
    expect(monthRange(2026, 12)).toEqual({ startISO: '2026-12-01', endISO: '2027-01-01' })
  })
})
describe('monthKey', () => {
  it('extracts YYYY-MM', () => {
    expect(monthKey('2026-03-14')).toBe('2026-03')
  })
})
describe('sumCents', () => {
  it('sums amount_cents', () => {
    expect(sumCents([{ amount_cents: 100 }, { amount_cents: 250 }])).toBe(350)
    expect(sumCents([])).toBe(0)
  })
})
describe('groupByDay', () => {
  it('groups by date, newest first, with Today/Yesterday labels and per-day totals', () => {
    const rows = [
      row('a', '2026-07-04', 1000),
      row('b', '2026-07-04', 500),
      row('c', '2026-07-03', 2000),
    ]
    const groups = groupByDay(rows, '2026-07-04')
    expect(groups.map(g => g.date)).toEqual(['2026-07-04', '2026-07-03'])
    expect(groups[0].label).toBe('Today')
    expect(groups[0].totalCents).toBe(1500)
    expect(groups[1].label).toBe('Yesterday')
    expect(groups[1].rows.map(r => r.id)).toEqual(['c'])
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test` → Expected: FAIL (`./summary` not found).

- [ ] **Step 3: Implement `types.ts` then `summary.ts`**

`src/lib/data/types.ts`:

```ts
export type Member = 'CH' | 'JC'
export type ExpenseRow = {
  id: string
  date: string
  vendor: string | null
  details: string | null
  category: string | null
  amount_cents: number
  paid_by: Member | null
}
export type DayGroup = { date: string; label: string; totalCents: number; rows: ExpenseRow[] }
export type Membership = { householdId: string; memberCode: Member; language: 'en' | 'zh'; displayName: string }
```

`src/lib/data/summary.ts`:

```ts
import type { ExpenseRow, DayGroup } from './types'

const pad = (n: number) => String(n).padStart(2, '0')

export function monthRange(year: number, month1to12: number) {
  const startISO = `${year}-${pad(month1to12)}-01`
  const ny = month1to12 === 12 ? year + 1 : year
  const nm = month1to12 === 12 ? 1 : month1to12 + 1
  const endISO = `${ny}-${pad(nm)}-01`
  return { startISO, endISO }
}

export const monthKey = (dateISO: string) => dateISO.slice(0, 7)

export const sumCents = (rows: { amount_cents: number }[]) =>
  rows.reduce((acc, r) => acc + r.amount_cents, 0)

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
function shortLabel(dateISO: string) {
  const [, m, d] = dateISO.split('-').map(Number)
  return `${MONTHS[m - 1]} ${d}`
}
function daysBetween(aISO: string, bISO: string) {
  const a = Date.parse(aISO + 'T00:00:00Z')
  const b = Date.parse(bISO + 'T00:00:00Z')
  return Math.round((a - b) / 86400000)
}

export function groupByDay(rows: ExpenseRow[], todayISO: string): DayGroup[] {
  const byDate = new Map<string, ExpenseRow[]>()
  for (const r of rows) {
    if (!byDate.has(r.date)) byDate.set(r.date, [])
    byDate.get(r.date)!.push(r)
  }
  const dates = [...byDate.keys()].sort((a, b) => (a < b ? 1 : -1)) // newest first
  return dates.map((date) => {
    const diff = daysBetween(todayISO, date)
    const label = diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : shortLabel(date)
    const dayRows = byDate.get(date)!
    return { date, label, totalCents: sumCents(dayRows), rows: dayRows }
  })
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test` → Expected: PASS (summary + existing suites green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/summary.ts src/lib/data/summary.test.ts src/lib/data/types.ts
git commit -m "feat: pure summary/date utils for expenses (tested)"
```

---

## Task 2: Category catalog + membership helper

**Files:**
- Create: `src/lib/categories.ts`, `src/lib/data/household.ts`

**Interfaces:**
- Consumes: `createClient()` from `@/lib/supabase/server`; `Membership` from `@/lib/data/types`.
- Produces:
  - `categories.ts`: `type CategoryKey`; `CATEGORIES: { key: CategoryKey; en: string; zh: string; icon: string; tint: string }[]` and `categoryLabel(key, locale)`. Keys: `food, groceries, transport, house, leo, dining, utilities, health` (+ implicit `uncategorized`). `icon` = lucide icon name string; `tint` = a token var name for the tile.
  - `household.ts`: `async getMembership(): Promise<Membership | null>` — looks up `household_members` joined to `profiles` for `auth.uid()`.

- [ ] **Step 1: Write `categories.ts`**

```ts
export type CategoryKey =
  | 'food' | 'groceries' | 'transport' | 'house' | 'leo' | 'dining' | 'utilities' | 'health' | 'uncategorized'

export const CATEGORIES: { key: CategoryKey; en: string; zh: string; icon: string; tint: string }[] = [
  { key: 'food',        en: 'Food',       zh: '餐饮',   icon: 'Utensils',    tint: 'var(--pending-bg)' },
  { key: 'groceries',   en: 'Groceries',  zh: '杂货',   icon: 'ShoppingCart',tint: 'var(--positive-bg)' },
  { key: 'transport',   en: 'Transport',  zh: '交通',   icon: 'Car',         tint: 'var(--info-bg)' },
  { key: 'house',       en: 'House',      zh: '房屋',   icon: 'Home',        tint: 'var(--subtle)' },
  { key: 'leo',         en: 'Leo',        zh: 'Leo',    icon: 'Baby',        tint: 'var(--peach)' },
  { key: 'dining',      en: 'Dining',     zh: '外食',   icon: 'CookingPot',  tint: 'var(--pending-bg)' },
  { key: 'utilities',   en: 'Utilities',  zh: '水电',   icon: 'Plug',        tint: 'var(--info-bg)' },
  { key: 'health',      en: 'Health',     zh: '健康',   icon: 'HeartPulse',  tint: 'var(--positive-bg)' },
]

const LABELS: Record<string, { en: string; zh: string }> = Object.fromEntries(
  [...CATEGORIES, { key: 'uncategorized', en: 'Uncategorized', zh: '未分类', icon: 'Tag', tint: 'var(--subtle)' }]
    .map((c) => [c.key, { en: c.en, zh: c.zh }])
)
export function categoryLabel(key: string | null, locale: 'en' | 'zh'): string {
  const k = key ?? 'uncategorized'
  return LABELS[k]?.[locale] ?? LABELS['uncategorized'][locale]
}
```

- [ ] **Step 2: Write `household.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import type { Membership } from './types'

export async function getMembership(): Promise<Membership | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase
    .from('household_members')
    .select('household_id, member_code, profiles!inner(display_name, language)')
    .eq('user_id', user.id)
    .single()
  if (error || !data) return null
  const profile = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles
  return {
    householdId: data.household_id,
    memberCode: data.member_code as Membership['memberCode'],
    language: (profile?.language ?? 'en') as Membership['language'],
    displayName: profile?.display_name ?? data.member_code,
  }
}
```

- [ ] **Step 3: Verify build/types**

Run: `npx tsc --noEmit` → Expected: clean.
Run: `npm run build` → Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/lib/categories.ts src/lib/data/household.ts
git commit -m "feat: expense category catalog + getMembership() helper"
```

---

## Task 3: i18n runtime provider + wire the shell

**Files:**
- Modify: `src/i18n/dictionaries.ts` (+ `src/i18n/dictionaries.test.ts`)
- Create: `src/i18n/LocaleProvider.tsx`
- Modify: `src/app/(app)/layout.tsx`, `src/components/nav/BottomTabBar.tsx`

**Interfaces:**
- Produces:
  - `LocaleProvider` (client) taking `initialLocale: Locale`, providing context.
  - `useLocale(): Locale` and `useT(): (key: string) => string` hooks.
- Consumes: `getMembership()` for the server-provided initial locale.

- [ ] **Step 1: Extend dictionaries with Phase 2 keys (en + zh), and extend the parity test**

Add these keys to BOTH locales in `src/i18n/dictionaries.ts` (append inside each map). English values shown; provide the matching zh values in the same edit:

```
'home.greeting.morning' -> 'Good morning' / '早安'
'home.jointFund' -> 'Joint Fund' / '共同基金'
'home.budget' -> 'Budget' / '预算'
'home.onTrack' -> "You're on track" / '预算充足'
'home.left' -> 'left' / '剩余'
'home.spent' -> 'spent' / '已花'
'home.personalLedgers' -> 'Personal ledgers' / '个人账本'
'home.upcoming' -> 'Upcoming' / '即将到期'
'home.viewAll' -> 'View all' / '查看全部'
'home.paid' -> 'paid' / '已付'
'home.pending' -> 'pending' / '待付'
'expenses.title' -> 'Expenses' / '开支'
'expenses.spentThisMonth' -> 'spent this month' / '本月已花'
'expenses.all' -> 'All' / '全部'
'expenses.empty' -> 'No expenses this month — tap ＋ to add' / '本月暂无开支 — 点击 ＋ 添加'
'expenses.edit' -> 'Edit' / '编辑'
'expenses.delete' -> 'Delete' / '删除'
'add.title' -> 'Add Expense' / '添加开支'
'add.whoPaid' -> 'Who paid?' / '谁支付？'
'add.note' -> 'Add note or vendor' / '备注或商家'
'add.today' -> 'Today' / '今天'
'add.save' -> 'Save Expense' / '保存'
'common.today' -> 'Today' / '今天'
'common.yesterday' -> 'Yesterday' / '昨天'
```

Extend `dictionaries.test.ts` with a parity test asserting every `en` key exists in `zh`:

```ts
import { describe, it, expect } from 'vitest'
import { dictionaries } from './dictionaries'
describe('locale parity', () => {
  it('every en key (except test.*) has a zh translation', () => {
    const missing = Object.keys(dictionaries.en)
      .filter((k) => !k.startsWith('test.'))
      .filter((k) => !(k in dictionaries.zh))
    expect(missing).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify the parity test fails if any zh key is missing, then passes once added**

Run: `npm test` → Expected: PASS after you add all zh values (fix any listed missing keys).

- [ ] **Step 3: Create `LocaleProvider.tsx`**

```tsx
'use client'
import { createContext, useContext } from 'react'
import { t as translate, type Locale } from './index'

const LocaleContext = createContext<Locale>('en')
export function LocaleProvider({ initialLocale, children }: { initialLocale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={initialLocale}>{children}</LocaleContext.Provider>
}
export function useLocale(): Locale {
  return useContext(LocaleContext)
}
export function useT() {
  const locale = useLocale()
  return (key: string) => translate(locale, key)
}
```

- [ ] **Step 4: Make `(app)/layout.tsx` a server component that seeds the provider**

```tsx
import { BottomTabBar } from '@/components/nav/BottomTabBar'
import { LocaleProvider } from '@/i18n/LocaleProvider'
import { getMembership } from '@/lib/data/household'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const membership = await getMembership()
  const locale = membership?.language ?? 'en'
  return (
    <LocaleProvider initialLocale={locale}>
      <div className="min-h-dvh bg-[var(--paper)]">
        <div className="mx-auto max-w-[430px] px-[18px] pb-[96px] pt-4">{children}</div>
        <BottomTabBar />
      </div>
    </LocaleProvider>
  )
}
```

- [ ] **Step 5: Wire `BottomTabBar` labels via `useT()`**

Change the `TABS` labels to i18n keys and translate at render:

```tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Receipt, HandCoins, ChartColumn, LayoutGrid } from 'lucide-react'
import { useT } from '@/i18n/LocaleProvider'
const TABS = [
  { href: '/', key: 'nav.home', Icon: Home },
  { href: '/expenses', key: 'nav.expenses', Icon: Receipt },
  { href: '/fund', key: 'nav.fund', Icon: HandCoins },
  { href: '/budget', key: 'nav.budget', Icon: ChartColumn },
  { href: '/assets', key: 'nav.assets', Icon: LayoutGrid },
]
export function BottomTabBar() {
  const path = usePathname()
  const t = useT()
  return (
    <nav className="fixed inset-x-0 bottom-0 h-[84px] border-t border-[var(--hairline)] bg-[var(--surface)]"
         style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <ul className="mx-auto flex h-[60px] max-w-[430px] items-stretch justify-around">
        {TABS.map(({ href, key, Icon }) => {
          const active = href === '/' ? path === '/' : path.startsWith(href)
          return (
            <li key={href} className="flex-1">
              <Link href={href} className="flex h-full flex-col items-center justify-center gap-1"
                    style={{ color: active ? 'var(--primary)' : 'var(--faint)' }}>
                <Icon size={22} strokeWidth={active ? 2.4 : 2} />
                <span className="text-[10px] font-semibold">{t(key)}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
```

- [ ] **Step 6: Verify**

Run: `npm test` → Expected: PASS (parity + prior suites).
Run: `npm run build` → Expected: succeeds (layout is async server component; BottomTabBar stays client).

- [ ] **Step 7: Commit**

```bash
git add src/i18n src/app/\(app\)/layout.tsx src/components/nav/BottomTabBar.tsx
git commit -m "feat: i18n runtime provider (useT) wired into app shell from profiles.language"
```

---

## Task 4: Shared UI primitives

**Files:**
- Create: `src/components/ui/Card.tsx`, `ProgressBar.tsx`, `MemberAvatar.tsx`, `IconTile.tsx`, `StatusChip.tsx`, `MoneyText.tsx`, `Fab.tsx`

**Interfaces:**
- Produces (all styled with Kita tokens; props typed):
  - `Card({ children, className })` — surface card: `rounded-[16px] bg-[var(--surface)] p-4 shadow-[0_3px_10px_oklch(0.5_0.05_45/.05)]`.
  - `HeroCard({ children, className })` — `rounded-[26px] p-5 text-white` with `style={{ background: 'var(--hero-grad)' }}`.
  - `ProgressBar({ value }: { value: number /*0..1*/, trackClassName?, barClassName? })` — rounded track + fill; default fill terracotta.
  - `MemberAvatar({ member, size=42 })` — circle, CH→peach bg, JC→blue bg, white initials.
  - `IconTile({ name, tint })` — rounded tile (radius 12) bg `tint`, renders a lucide icon by `name` (map via a small `ICONS` record of the names used in `categories.ts` + reminders: Utensils, ShoppingCart, Car, Home, Baby, CookingPot, Plug, HeartPulse, Tag, HandCoins, Zap, Droplet, ShieldCheck).
  - `StatusChip({ status }: { status: 'paid'|'pending'|'upcoming'|'closed' })` — pill with the matching token colors (paid→positive, pending/upcoming→pending, closed→neutral).
  - `MoneyText({ cents, className })` — renders `formatRM(cents)` with `tabular-nums`.
  - `Fab({ href, label? })` — terracotta circle (56px) or pill when `label` given; fixed bottom-right ~100px above the bar, shadow per tokens.

- [ ] **Step 1: Implement the components**

Follow the handoff *Design Tokens*, *Radius*, and *Shadow* sections. For `IconTile`, resolve lucide icons through an explicit record (do NOT dynamic-import by string):

```tsx
import { Utensils, ShoppingCart, Car, Home, Baby, CookingPot, Plug, HeartPulse, Tag, HandCoins, Zap, Droplet, ShieldCheck, type LucideIcon } from 'lucide-react'
export const ICONS: Record<string, LucideIcon> = { Utensils, ShoppingCart, Car, Home, Baby, CookingPot, Plug, HeartPulse, Tag, HandCoins, Zap, Droplet, ShieldCheck }
```

`MoneyText` must import `formatRM` from `@/lib/money`.

- [ ] **Step 2: Temporary preview + verify, then delete preview**

Create a throwaway `src/app/(app)/_ui-preview/page.tsx` rendering one of each primitive with sample props. Run `npm run build`; confirm it compiles. Then DELETE `src/app/(app)/_ui-preview` so it is not committed.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` and `npm run build` → Expected: both pass; no `_ui-preview` route in the final build output.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui
git commit -m "feat: shared UI primitives (Card, HeroCard, ProgressBar, avatars, chips, FAB)"
```

---

## Task 5: Expenses data functions + addExpense action

**Files:**
- Create: `src/lib/data/expenses.ts`, `src/app/(app)/expenses/add/actions.ts`

**Interfaces:**
- Consumes: `getMembership()`, `createClient()` (server), `ExpenseRow`, `monthRange`.
- Produces:
  - `listExpenses(opts?: { year?: number; month?: number }): Promise<ExpenseRow[]>` — household-scoped, ordered by `date desc`; when `year`+`month` given, restricted to that month via `monthRange`; otherwise returns all rows (most recent first).
  - `getMonthTotalCents(year: number, month: number): Promise<number>` — sum of `amount_cents` for that month.
  - `addExpense(input: { amountCents: number; category: string | null; paidBy: 'CH'|'JC'|null; note: string | null; dateISO: string }): Promise<{ ok: true } | { ok: false; error: string }>` — inserts with server-derived `household_id`, `created_by = auth uid`, mapping `note` → `details`.
  - `deleteExpense(id: string): Promise<void>`
  - the server action `addExpenseAction(formData)` in `add/actions.ts` calls `addExpense` then `redirect('/expenses')`.

- [ ] **Step 1: Implement `expenses.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import { getMembership } from './household'
import { monthRange } from './summary'
import type { ExpenseRow } from './types'

const COLS = 'id, date, vendor, details, category, amount_cents, paid_by'

export async function listExpenses(opts?: { year?: number; month?: number }): Promise<ExpenseRow[]> {
  const m = await getMembership()
  if (!m) return []
  const supabase = await createClient()
  let q = supabase.from('expenses').select(COLS).eq('household_id', m.householdId).order('date', { ascending: false })
  if (opts?.year && opts?.month) {
    const { startISO, endISO } = monthRange(opts.year, opts.month)
    q = q.gte('date', startISO).lt('date', endISO)
  }
  const { data, error } = await q
  if (error || !data) return []
  return data as ExpenseRow[]
}

export async function getMonthTotalCents(year: number, month: number): Promise<number> {
  const rows = await listExpenses({ year, month })
  return rows.reduce((a, r) => a + r.amount_cents, 0)
}

export async function addExpense(input: {
  amountCents: number; category: string | null; paidBy: 'CH' | 'JC' | null; note: string | null; dateISO: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'Not authenticated' }
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) return { ok: false, error: 'Enter an amount' }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase.from('expenses').insert({
    household_id: m.householdId,
    date: input.dateISO,
    details: input.note,
    category: input.category,
    amount_cents: input.amountCents,
    paid_by: input.paidBy,
    created_by: user?.id ?? null,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function deleteExpense(id: string): Promise<void> {
  const m = await getMembership()
  if (!m) return
  const supabase = await createClient()
  await supabase.from('expenses').delete().eq('id', id).eq('household_id', m.householdId)
}
```

- [ ] **Step 2: Implement the server action `add/actions.ts`**

```ts
'use server'
import { addExpense } from '@/lib/data/expenses'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function addExpenseAction(formData: FormData) {
  const amountCents = Number(formData.get('amountCents'))
  const category = (formData.get('category') as string) || null
  const paidByRaw = (formData.get('paidBy') as string) || ''
  const paidBy = paidByRaw === 'CH' || paidByRaw === 'JC' ? paidByRaw : null
  const note = (formData.get('note') as string) || null
  const dateISO = (formData.get('dateISO') as string) || new Date().toISOString().slice(0, 10)
  const res = await addExpense({ amountCents, category, paidBy, note, dateISO })
  if (!res.ok) redirect('/expenses/add?error=' + encodeURIComponent(res.error))
  revalidatePath('/expenses'); revalidatePath('/')
  redirect('/expenses')
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` and `npm run build` → Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/data/expenses.ts src/app/\(app\)/expenses/add/actions.ts
git commit -m "feat: expenses data layer + addExpense server action (household-scoped)"
```

---

## Task 6: Add Expense screen (2A)

**Files:**
- Create: `src/app/(app)/expenses/add/page.tsx`, `src/app/(app)/expenses/add/AddExpenseForm.tsx`

**Interfaces:**
- Consumes: `addExpenseAction`, `useT`, `CATEGORIES`, `MemberAvatar`, `formatRM`, `pushDigit`/`pushDoubleZero`/`backspace`.
- Produces: the full-screen amount-first capture flow per handoff **§2A**.

**Recreate handoff §2A exactly.** Layout top→bottom: header (`‹` back link to `/expenses` · title `t('add.title')` · `×` close to `/expenses`); centered **amount** (micro label + huge `formatRM(cents)` with a blinking terracotta caret); **Who paid?** segmented `CH`/`JC` (each with `MemberAvatar`; selected = filled member color); **category chips** from `CATEGORIES` (wrapping pills; selected = terracotta filled); **note** input (`t('add.note')`) with a `Today` date pill; pushed to bottom the **numeric keypad** (3×4: 1-9, `00`, `0`, `⌫`, keys 50px tall); **Save** primary button (`t('add.save')`).

- [ ] **Step 1: Build `AddExpenseForm.tsx` (client)**

Requirements the implementer must satisfy:
- State: `cents` (number, start 0), `payer: 'CH'|'JC'|null`, `category: CategoryKey|null`, `note: string`.
- Keypad: digit keys call `setCents(c => pushDigit(c, d))`; `00` → `pushDoubleZero`; `⌫` → `backspace`. Amount displays `formatRM(cents)`.
- Payer + category are single-select (tap toggles/sets).
- Submits via a `<form action={addExpenseAction}>` with hidden inputs `amountCents`, `category`, `paidBy`, `note`, `dateISO` (today `new Date().toISOString().slice(0,10)`), so the server action receives them. The visible keypad drives the hidden `amountCents` value.
- Save disabled while `cents <= 0`.
- Reads `?error=` from props to show an error line.

- [ ] **Step 2: Build `add/page.tsx` (route)**

Server component: reads `searchParams` (await — Next 16), renders header + `<AddExpenseForm error={...} />`. No bottom tab bar on this full-screen flow (it renders under `(app)` which has the bar — to hide it, this route should NOT be under the tab layout OR the form overlays it; simplest: keep under `(app)` and accept the bar, OR render as a full-height overlay with higher z-index. Choose: render the form in a `fixed inset-0 z-50 bg-[var(--paper)]` container so it covers the tab bar, matching the handoff's "full-screen, no tab bar".)

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` and `npm run build` → Expected: both pass; route `/expenses/add` present.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/expenses/add/page.tsx src/app/\(app\)/expenses/add/AddExpenseForm.tsx
git commit -m "feat: Add Expense screen (2A) — amount-first keypad flow"
```

---

## Task 7: Expenses list screen (2B)

**Files:**
- Create: `src/app/(app)/expenses/page.tsx`, `src/app/(app)/expenses/ExpensesView.tsx`

**Interfaces:**
- Consumes: `listExpenses`, `getMonthTotalCents`, `groupByDay`, `CATEGORIES`/`categoryLabel`, `IconTile`, `MoneyText`, `Fab`, `deleteExpense`, `useT`.
- Produces: the Expenses list per handoff **§2B**, plus a **month stepper** (justified addition — see Data Realities).

**Recreate handoff §2B**, adapting the header to include a month stepper. Layout: header `t('expenses.title')`; a **month stepper** `‹ {Month YYYY} ›` (prev/next); big running total `MoneyText` for the selected month + `t('expenses.spentThisMonth')`; **filter chips** (`All` + the categories present); **date-grouped list** via `groupByDay` (each group: localized day header — map `Today`/`Yesterday` to `common.today`/`common.yesterday`, else the short label — + right-aligned group subtotal; each row: `IconTile` for the category · vendor/details + `categoryLabel · payer` · `MoneyText`). **Swipe-to-reveal** Edit/Delete per row (Delete calls a server action wrapping `deleteExpense`). `Fab` `＋` → `/expenses/add`. Empty month → `t('expenses.empty')`.

- [ ] **Step 1: `page.tsx` (server)**

Reads `searchParams` for `?y=&m=` (default to current year/month from `new Date()`), calls `listExpenses({year,month})` + `getMonthTotalCents`, passes rows + totals + selected month to `<ExpensesView />`.

- [ ] **Step 2: `ExpensesView.tsx` (client)**

Holds filter state (selected category chip) and swipe interaction; receives rows/total/month + a `deleteAction` (server action passed from page or imported). Month stepper navigates by pushing `/expenses?y=&m=` (via `next/navigation` `useRouter`). Renders `groupByDay(filteredRows, todayISO)`.

Add a `deleteExpense` server action in a small `expenses/actions.ts`:

```ts
'use server'
import { deleteExpense } from '@/lib/data/expenses'
import { revalidatePath } from 'next/cache'
export async function deleteExpenseAction(id: string) {
  await deleteExpense(id)
  revalidatePath('/expenses'); revalidatePath('/')
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` and `npm run build` → Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/expenses/page.tsx src/app/\(app\)/expenses/ExpensesView.tsx src/app/\(app\)/expenses/actions.ts
git commit -m "feat: Expenses list (2B) — month stepper, filters, grouped rows, swipe delete"
```

---

## Task 8: Home dashboard (1A)

**Files:**
- Create: `src/lib/data/home.ts`, `src/app/(app)/page.tsx` (replaces the placeholder)

**Interfaces:**
- Consumes: `getMembership`, `createClient`, `getMonthTotalCents`, summary utils, UI primitives, `useT`.
- Produces:
  - `getHomeSummary(): Promise<HomeSummary>` where
    `HomeSummary = { monthLabel: string; jointFund: { chPaid: boolean; jcPaid: boolean; contributedCents: number; expectedThisMonthCents: number; yearContributedCents: number; yearExpectedCents: number }; budget: { totalCents: number; spentCents: number }; upcoming: { icon: string; title: string; due: string; amountCents: number; status: 'pending'|'upcoming' }[] }`.
  - Home page rendering per handoff **§1A**.

**Compute `getHomeSummary` from real data (current calendar month):**
- Joint fund: query `joint_fund_contributions` for the household; `chPaid`/`jcPaid` = this month's row `status='paid'` per member; `contributedCents` = sum of paid this month; `expectedThisMonthCents` = sum of `joint_fund_config.expected_monthly_cents`; `yearContributedCents` = sum of all paid contributions; `yearExpectedCents` = `sum(expected_monthly)*12 + sum(carry_forward)`.
- Budget: `totalCents` = sum of `budget_categories.total_cents`; `spentCents` = `getMonthTotalCents(currentYear, currentMonth)`.
- Upcoming (max 3): this month's **pending** joint-fund contributions (`title = "{member} · Joint Fund"`, icon `HandCoins`, status pending), then `monthly_commitments` (icon `Zap`, status upcoming), then the next unsettled AIA `scheduled_payment` (icon `ShieldCheck`, status upcoming). Order pending first.

**Recreate handoff §1A** with these bindings: header greeting `t('home.greeting.morning') + ', ' + membership.displayName` + `monthLabel`; a gear button (link `/settings`, may 404 in Phase 2 — acceptable) + `MemberAvatar`. Then: **Joint Fund hero** (`HeroCard`): `home.jointFund`, big `MoneyText(contributedCents)` + muted `/ MoneyText(expectedThisMonthCents)`, progress = contributed/expected, two chips `CH {paid|pending}` / `JC {paid|pending}` (StatusChip). **Budget** `Card`: `home.budget` + `home.onTrack`, `MoneyText(totalCents - spentCents)` + `home.left`, progress = spent/total, footer `MoneyText(spentCents) home.spent · MoneyText(totalCents)`. **Personal ledgers** `Card`: overlapping `MemberAvatar`s + `home.personalLedgers` + neutral subtitle (NO numbers in Phase 2; not a link). **Upcoming** `Card`: header `home.upcoming` + `home.viewAll`; up to 3 rows (`IconTile` · title · due · `MoneyText` · `StatusChip`). **`Fab`** pill `＋ {t('add.title')}` → `/expenses/add`.

- [ ] **Step 1: Implement `home.ts`**

Implement `getHomeSummary` per the bindings above. Use `new Date()` for the current year/month and a human `monthLabel` (e.g. `July 2026`).

- [ ] **Step 2: Implement `page.tsx` (server component) per §1A**

Fetch `getMembership()` + `getHomeSummary()`, render the four cards + FAB using the UI primitives. Client bits (none strictly needed; the FAB is a link). Keep it a server component.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`, `npm run build`, `npm test` → Expected: all pass; `/` renders the dashboard.

- [ ] **Step 4: Commit**

```bash
git add src/lib/data/home.ts src/app/\(app\)/page.tsx
git commit -m "feat: Home dashboard (1A) wired to joint fund + budget + upcoming"
```

---

## Phase 2 Done — Definition of Done

- Signed in, `/` shows the Home dashboard with **real** joint-fund status, budget-vs-spent, and upcoming reminders for the current month.
- `/expenses/add` captures an expense (keypad cents accumulator, payer, category, note) and saves it; it appears in the list and updates Home.
- `/expenses` lists expenses grouped by day with the month's running total, category filters, a month stepper to browse imported months, and swipe-to-delete.
- Bottom-tab labels and all Phase 2 screen strings render in EN and switch to 中文 when `profiles.language = 'zh'`.
- `npm test` green (summary + i18n parity + prior suites); `npm run build` succeeds.

Next: **Phase 3** (Joint Fund `2C`, Budget `2D`).
```
