# Customizable Bottom Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each user reorder the bottom-nav destinations and choose which appear in the bar vs the "More" overflow, saved per-user in Supabase and synced across devices.

**Architecture:** A pure `nav-shared.ts` module holds the six tab definitions, the default layout, and two pure functions (`parseLayout`, `resolveActiveTab`) that are the single source of truth. The layout is stored as a `tab_order jsonb` column on `profiles`, read through the existing `getMembership()` and passed server-side into `BottomTabBar` (no client flash). A Settings editor (`NavOrderEditor`) mutates it via an `updateTabOrder` server action that `revalidatePath`s the layout.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind 4, Supabase (Postgres + RLS), vitest + jsdom, lucide-react.

## Global Constraints

- **Money is irrelevant here** — no money handling in this feature.
- **Pure vs server split:** `nav-shared.ts` MUST stay framework-free (no Supabase, no `next/headers`, no React components). Icons are referenced by string name in the pure module; the name→component map lives in a separate client-importable module.
- **RLS:** all reads/writes go through the anon client (`@/lib/supabase/server`), scoped to the current user. Never use the admin client here.
- **Locale parity is tested:** every key added to `dictionaries.en` MUST also be added to `dictionaries.zh`, or `src/i18n/dictionaries.test.ts` fails.
- **Bar cap:** the bar holds 1–4 primary destinations; a fixed, non-movable "More" tab is always the last slot. `MAX_BAR = 4`.
- **Tab ids** are the stable keys everywhere: `home`, `expenses`, `fund`, `budget`, `assets`, `manage`.
- **Test convention:** vitest, colocated `*.test.ts`, `@/` maps to `src/`. Run a single file with `npx vitest run <path>`.
- **DB changes** are applied manually in the Supabase SQL editor (no local migration tooling); edit `supabase/migrations/0001_schema.sql` AND provide the `alter` to run in the dashboard.

---

### Task 1: Pure nav module (`nav-shared.ts`)

**Files:**
- Create: `src/lib/nav/nav-shared.ts`
- Test: `src/lib/nav/nav-shared.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type TabId = 'home' | 'expenses' | 'fund' | 'budget' | 'assets' | 'manage'`
  - `type NavLayout = { bar: TabId[]; more: TabId[] }`
  - `type TabDef = { id: TabId; href: string; i18nKey: string; iconName: string; matchPrefixes: string[] }`
  - `const TAB_DEFS: TabDef[]`
  - `const TAB_IDS: TabId[]`
  - `const MAX_BAR = 4`
  - `const DEFAULT_LAYOUT: NavLayout`
  - `function parseLayout(raw: unknown): NavLayout`
  - `function resolveActiveTab(pathname: string, layout: NavLayout): TabId | 'more' | null`

- [ ] **Step 1: Write the failing test**

Create `src/lib/nav/nav-shared.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  parseLayout, resolveActiveTab, DEFAULT_LAYOUT, TAB_IDS, MAX_BAR,
} from './nav-shared'

describe('parseLayout', () => {
  it('returns the default layout for null/undefined/garbage', () => {
    expect(parseLayout(null)).toEqual(DEFAULT_LAYOUT)
    expect(parseLayout(undefined)).toEqual(DEFAULT_LAYOUT)
    expect(parseLayout(42)).toEqual(DEFAULT_LAYOUT)
    expect(parseLayout('nope')).toEqual(DEFAULT_LAYOUT)
  })

  it('preserves a valid layout unchanged', () => {
    const layout = { bar: ['home', 'fund'], more: ['expenses', 'budget', 'assets', 'manage'] }
    expect(parseLayout(layout)).toEqual(layout)
  })

  it('drops unknown ids', () => {
    const out = parseLayout({ bar: ['home', 'bogus'], more: ['expenses'] })
    expect(out.bar).toEqual(['home'])
    expect(out.bar).not.toContain('bogus')
  })

  it('appends missing known ids to more', () => {
    const out = parseLayout({ bar: ['home'], more: ['expenses'] })
    const all = [...out.bar, ...out.more].sort()
    expect(all).toEqual([...TAB_IDS].sort())
  })

  it('deduplicates across bar and more, bar wins', () => {
    const out = parseLayout({ bar: ['home', 'home'], more: ['home', 'expenses'] })
    expect(out.bar).toEqual(['home'])
    expect(out.more).not.toContain('home')
  })

  it('spills over-cap bar items to the front of more', () => {
    const out = parseLayout({
      bar: ['home', 'expenses', 'fund', 'budget', 'assets'], more: ['manage'],
    })
    expect(out.bar).toHaveLength(MAX_BAR)
    expect(out.bar).toEqual(['home', 'expenses', 'fund', 'budget'])
    expect(out.more[0]).toBe('assets')
  })

  it('falls back to default when the bar would be empty', () => {
    expect(parseLayout({ bar: [], more: TAB_IDS })).toEqual(DEFAULT_LAYOUT)
  })
})

describe('resolveActiveTab', () => {
  it('matches each bar destination by prefix', () => {
    const l = DEFAULT_LAYOUT
    expect(resolveActiveTab('/', l)).toBe('home')
    expect(resolveActiveTab('/personal', l)).toBe('home')
    expect(resolveActiveTab('/expenses', l)).toBe('expenses')
    expect(resolveActiveTab('/expenses/123', l)).toBe('expenses')
    expect(resolveActiveTab('/fund', l)).toBe('fund')
    expect(resolveActiveTab('/budget', l)).toBe('budget')
  })

  it('resolves the More slot for destinations that live in more', () => {
    expect(resolveActiveTab('/assets', DEFAULT_LAYOUT)).toBe('more')
    expect(resolveActiveTab('/manage', DEFAULT_LAYOUT)).toBe('more')
    expect(resolveActiveTab('/more', DEFAULT_LAYOUT)).toBe('more')
  })

  it('resolves a promoted destination to its own bar slot', () => {
    const promoted = { bar: ['home', 'expenses', 'fund', 'assets'], more: ['budget', 'manage'] }
    expect(resolveActiveTab('/assets', promoted)).toBe('assets')
    expect(resolveActiveTab('/budget', promoted)).toBe('more')
  })

  it('returns null when nothing matches', () => {
    expect(resolveActiveTab('/login', DEFAULT_LAYOUT)).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/nav/nav-shared.test.ts`
Expected: FAIL — cannot resolve `./nav-shared`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/nav/nav-shared.ts`:

```ts
// Pure, framework-free nav model. No Supabase, no next/headers, no React.
// Icons are referenced by name; the name->component map lives beside the renderers.

export type TabId = 'home' | 'expenses' | 'fund' | 'budget' | 'assets' | 'manage'

export type NavLayout = { bar: TabId[]; more: TabId[] }

export type TabDef = {
  id: TabId
  href: string
  i18nKey: string
  iconName: string
  matchPrefixes: string[]
}

export const MAX_BAR = 4

// Order here is the canonical default order.
export const TAB_DEFS: TabDef[] = [
  { id: 'home', href: '/', i18nKey: 'nav.home', iconName: 'home', matchPrefixes: ['/personal'] },
  { id: 'expenses', href: '/expenses', i18nKey: 'nav.expenses', iconName: 'expenses', matchPrefixes: [] },
  { id: 'fund', href: '/fund', i18nKey: 'nav.fund', iconName: 'fund', matchPrefixes: [] },
  { id: 'budget', href: '/budget', i18nKey: 'nav.budget', iconName: 'budget', matchPrefixes: [] },
  { id: 'assets', href: '/assets', i18nKey: 'nav.assets', iconName: 'assets', matchPrefixes: [] },
  { id: 'manage', href: '/manage', i18nKey: 'nav.manage', iconName: 'manage', matchPrefixes: [] },
]

export const TAB_IDS: TabId[] = TAB_DEFS.map((d) => d.id)

export const DEFAULT_LAYOUT: NavLayout = {
  bar: ['home', 'expenses', 'fund', 'budget'],
  more: ['assets', 'manage'],
}

function cloneDefault(): NavLayout {
  return { bar: [...DEFAULT_LAYOUT.bar], more: [...DEFAULT_LAYOUT.more] }
}

function isTabId(v: unknown): v is TabId {
  return typeof v === 'string' && (TAB_IDS as string[]).includes(v)
}

// Always returns a complete, valid layout: known ids only, no duplicates
// (bar wins), every tab present exactly once, bar length 1..MAX_BAR.
export function parseLayout(raw: unknown): NavLayout {
  if (!raw || typeof raw !== 'object') return cloneDefault()
  const r = raw as Record<string, unknown>
  const seen = new Set<TabId>()
  const take = (v: unknown): TabId[] => {
    if (!Array.isArray(v)) return []
    const out: TabId[] = []
    for (const x of v) {
      if (isTabId(x) && !seen.has(x)) { seen.add(x); out.push(x) }
    }
    return out
  }
  let bar = take(r.bar)
  let more = take(r.more)
  // Append any known ids not present in either list.
  for (const id of TAB_IDS) {
    if (!seen.has(id)) { seen.add(id); more.push(id) }
  }
  // Enforce the bar cap; overflow spills to the front of more.
  if (bar.length > MAX_BAR) {
    more = [...bar.slice(MAX_BAR), ...more]
    bar = bar.slice(0, MAX_BAR)
  }
  // The bar must never be empty.
  if (bar.length === 0) return cloneDefault()
  return { bar, more }
}

function tabMatches(def: TabDef, pathname: string): boolean {
  if (pathname === def.href) return true
  if (def.href !== '/' && pathname.startsWith(def.href)) return true
  return def.matchPrefixes.some((p) => pathname.startsWith(p))
}

// Returns the id of the matching bar tab, 'more' if the match lives in the
// More list (or the pathname is /more), or null if nothing matches.
export function resolveActiveTab(pathname: string, layout: NavLayout): TabId | 'more' | null {
  if (pathname === '/more' || pathname.startsWith('/more/')) return 'more'
  for (const def of TAB_DEFS) {
    if (tabMatches(def, pathname)) {
      return layout.bar.includes(def.id) ? def.id : 'more'
    }
  }
  return null
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/nav/nav-shared.test.ts`
Expected: PASS (all cases green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/nav/nav-shared.ts src/lib/nav/nav-shared.test.ts
git commit -m "feat(nav): pure nav layout model (parseLayout, resolveActiveTab)"
```

---

### Task 2: i18n keys for nav labels + settings editor

**Files:**
- Modify: `src/i18n/dictionaries.ts` (EN block near line 5 and 73; ZH block near line 246 and 314)
- Test: `src/i18n/dictionaries.test.ts` (parity test already covers this; add an explicit assertion)

**Interfaces:**
- Consumes: nothing.
- Produces the following keys, in BOTH `en` and `zh`:
  - `nav.manage`
  - `settings.nav`, `settings.nav.inBar`, `settings.nav.inMore`, `settings.nav.desc`
  - `settings.nav.moveUp`, `settings.nav.moveDown`, `settings.nav.toBar`, `settings.nav.toMore`

Note: `nav.home`, `nav.expenses`, `nav.fund`, `nav.budget`, `nav.assets`, `nav.more` already exist. Only `nav.manage` is new among nav labels.

- [ ] **Step 1: Add EN keys**

In `src/i18n/dictionaries.ts`, in the `en:` object, extend the nav line (currently line 5) to add `nav.manage`:

```ts
    'nav.budget': 'Budget', 'nav.assets': 'Assets', 'nav.manage': 'Manage', 'nav.more': 'More',
```

Then, immediately after the `'settings.notifications': 'Notifications',` line in the `en:` block, add:

```ts
    'settings.nav': 'Navigation',
    'settings.nav.desc': 'Choose which tabs appear in the bar and their order.',
    'settings.nav.inBar': 'In bar',
    'settings.nav.inMore': 'In More',
    'settings.nav.moveUp': 'Move up',
    'settings.nav.moveDown': 'Move down',
    'settings.nav.toBar': 'Move to bar',
    'settings.nav.toMore': 'Move to More',
```

- [ ] **Step 2: Add ZH keys**

In the `zh:` object, extend the nav line (currently line 246) to add `nav.manage`:

```ts
    'nav.budget': '预算', 'nav.assets': '资产', 'nav.manage': '管理', 'nav.more': '更多',
```

Then, immediately after the `'settings.notifications': '通知',` line in the `zh:` block, add:

```ts
    'settings.nav': '导航',
    'settings.nav.desc': '选择底部导航栏显示的标签及其顺序。',
    'settings.nav.inBar': '导航栏',
    'settings.nav.inMore': '更多菜单',
    'settings.nav.moveUp': '上移',
    'settings.nav.moveDown': '下移',
    'settings.nav.toBar': '移到导航栏',
    'settings.nav.toMore': '移到更多',
```

- [ ] **Step 3: Add an explicit parity assertion**

In `src/i18n/dictionaries.test.ts`, inside the `describe('t()', ...)` block, add:

```ts
  it('has nav.manage in both locales', () => {
    expect(t('en', 'nav.manage')).toBe('Manage')
    expect(t('zh', 'nav.manage')).toBe('管理')
  })
```

- [ ] **Step 4: Run the dictionary tests**

Run: `npx vitest run src/i18n/dictionaries.test.ts`
Expected: PASS — parity test green (no missing zh keys) and the new assertion passes.

- [ ] **Step 5: Commit**

```bash
git add src/i18n/dictionaries.ts src/i18n/dictionaries.test.ts
git commit -m "feat(i18n): nav.manage + settings.nav.* keys (en/zh)"
```

---

### Task 3: DB column + data-layer wiring

**Files:**
- Modify: `supabase/migrations/0001_schema.sql:8-14` (profiles table)
- Modify: `src/lib/data/types.ts` (Membership type)
- Modify: `src/lib/data/household.ts`

**Interfaces:**
- Consumes: `NavLayout`, `parseLayout` from Task 1.
- Produces: `Membership.tabOrder: NavLayout` (populated on every `getMembership()` call).

- [ ] **Step 1: Add the column to the schema file**

In `supabase/migrations/0001_schema.sql`, change the `profiles` table (lines 8–14) to add `tab_order`:

```sql
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  email text not null,
  language text not null default 'en' check (language in ('en','zh')),
  avatar_color text,
  tab_order jsonb
);
```

- [ ] **Step 2: Extend the Membership type**

In `src/lib/data/types.ts`, add the import at the top and extend `Membership`:

```ts
import type { NavLayout } from '@/lib/nav/nav-shared'
```

Change the `Membership` type (last line) to:

```ts
export type Membership = {
  householdId: string
  memberCode: Member
  language: 'en' | 'zh'
  displayName: string
  tabOrder: NavLayout
}
```

- [ ] **Step 3: Populate tabOrder in getMembership**

In `src/lib/data/household.ts`, add the import and extend the query + return:

```ts
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Membership } from './types'
import { parseLayout } from '@/lib/nav/nav-shared'

export const getMembership = cache(async (): Promise<Membership | null> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase
    .from('household_members')
    .select('household_id, member_code, profiles!inner(display_name, language, tab_order)')
    .eq('user_id', user.id)
    .single()
  if (error || !data) return null
  const profile = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles
  return {
    householdId: data.household_id,
    memberCode: data.member_code as Membership['memberCode'],
    language: (profile?.language ?? 'en') as Membership['language'],
    displayName: profile?.display_name ?? data.member_code,
    tabOrder: parseLayout(profile?.tab_order),
  }
})
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS — no type errors. Adding `tabOrder` to `Membership` does not break `getSettingsData` (it reads individual fields, not all of them); the new field is consumed in Task 6.

- [ ] **Step 5: Apply the column in Supabase**

Run this in the Supabase SQL editor (dashboard), since there is no local migration tooling:

```sql
alter table profiles add column if not exists tab_order jsonb;
```

Expected: "Success. No rows returned." Existing rows keep `tab_order = NULL`, which `parseLayout` maps to the default layout.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0001_schema.sql src/lib/data/types.ts src/lib/data/household.ts
git commit -m "feat(nav): persist tab_order on profiles, expose via getMembership"
```

---

### Task 4: Render the bar and More page from the layout

**Files:**
- Create: `src/components/nav/tab-icons.ts`
- Modify: `src/components/nav/BottomTabBar.tsx`
- Modify: `src/app/(app)/layout.tsx`
- Modify: `src/app/(app)/more/page.tsx`

**Interfaces:**
- Consumes: `NavLayout`, `TAB_DEFS`, `resolveActiveTab`, `DEFAULT_LAYOUT` from Task 1; `tabOrder` from Task 3; `nav.manage` from Task 2.
- Produces: `TAB_ICONS: Record<TabId, LucideIcon>` and `MORE_ICON: LucideIcon` from `tab-icons.ts`; `BottomTabBar` now takes a `layout: NavLayout` prop.

- [ ] **Step 1: Create the icon map**

Create `src/components/nav/tab-icons.ts`:

```ts
import { Home, Receipt, HandCoins, ChartColumn, LayoutGrid, SlidersHorizontal, MoreHorizontal, type LucideIcon } from 'lucide-react'
import type { TabId } from '@/lib/nav/nav-shared'

export const TAB_ICONS: Record<TabId, LucideIcon> = {
  home: Home,
  expenses: Receipt,
  fund: HandCoins,
  budget: ChartColumn,
  assets: LayoutGrid,
  manage: SlidersHorizontal,
}

export const MORE_ICON: LucideIcon = MoreHorizontal
```

- [ ] **Step 2: Rewrite BottomTabBar to render from the layout**

Replace the entire contents of `src/components/nav/BottomTabBar.tsx`:

```tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useT } from '@/i18n/LocaleProvider'
import { TAB_DEFS, resolveActiveTab, type NavLayout, type TabDef } from '@/lib/nav/nav-shared'
import { TAB_ICONS, MORE_ICON } from './tab-icons'

export function BottomTabBar({ layout }: { layout: NavLayout }) {
  const path = usePathname()
  const t = useT()
  const active = resolveActiveTab(path, layout)
  const barTabs = layout.bar
    .map((id) => TAB_DEFS.find((d) => d.id === id))
    .filter((d): d is TabDef => Boolean(d))

  const linkClass = 'pressable-opacity flex h-full flex-col items-center justify-center gap-1 transition-colors'
  const labelClass = 'text-[10px] font-semibold'

  return (
    <nav className="fixed inset-x-0 bottom-0 h-[84px] border-t border-[var(--hairline)] bg-[var(--surface)]"
         style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <ul className="mx-auto flex h-[60px] max-w-[430px] items-stretch justify-around">
        {barTabs.map((tab) => {
          const Icon = TAB_ICONS[tab.id]
          const isActive = active === tab.id
          return (
            <li key={tab.id} className="flex-1">
              <Link href={tab.href} className={linkClass}
                    style={{ color: isActive ? 'var(--primary)' : 'var(--faint)' }}>
                <Icon size={22} strokeWidth={isActive ? 2.4 : 2} />
                <span className={labelClass}>{t(tab.i18nKey)}</span>
              </Link>
            </li>
          )
        })}
        <li key="more" className="flex-1">
          <Link href="/more" className={linkClass}
                style={{ color: active === 'more' ? 'var(--primary)' : 'var(--faint)' }}>
            <MORE_ICON size={22} strokeWidth={active === 'more' ? 2.4 : 2} />
            <span className={labelClass}>{t('nav.more')}</span>
          </Link>
        </li>
      </ul>
    </nav>
  )
}
```

- [ ] **Step 3: Pass the layout from the app layout**

In `src/app/(app)/layout.tsx`, import `DEFAULT_LAYOUT` and pass the prop:

```tsx
/// <reference types="react/canary" />
import { ViewTransition } from 'react'
import { BottomTabBar } from '@/components/nav/BottomTabBar'
import { LocaleProvider } from '@/i18n/LocaleProvider'
import { getMembership } from '@/lib/data/household'
import { DEFAULT_LAYOUT } from '@/lib/nav/nav-shared'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const membership = await getMembership()
  const locale = membership?.language ?? 'en'
  const layout = membership?.tabOrder ?? DEFAULT_LAYOUT
  return (
    <LocaleProvider initialLocale={locale}>
      <div className="min-h-dvh bg-[var(--paper)]">
        <div className="mx-auto max-w-[430px] px-[18px] pb-[96px] pt-4">
          <ViewTransition enter="page-enter" exit="page-exit">
            {children}
          </ViewTransition>
        </div>
        <BottomTabBar layout={layout} />
      </div>
    </LocaleProvider>
  )
}
```

- [ ] **Step 4: Render the More page from the layout**

Replace the contents of `src/app/(app)/more/page.tsx`:

```tsx
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { getMembership } from '@/lib/data/household'
import { t } from '@/i18n'
import { TAB_DEFS, DEFAULT_LAYOUT } from '@/lib/nav/nav-shared'
import { TAB_ICONS } from '@/components/nav/tab-icons'

export default async function MorePage() {
  const m = await getMembership()
  const locale = m?.language ?? 'en'
  const layout = m?.tabOrder ?? DEFAULT_LAYOUT
  const items = layout.more
    .map((id) => TAB_DEFS.find((d) => d.id === id))
    .filter((d): d is (typeof TAB_DEFS)[number] => Boolean(d))
  return (
    <div className="flex flex-col gap-5 pb-6">
      <h1 className="text-2xl font-extrabold text-[var(--ink-head)]">{t(locale, 'more.title')}</h1>
      <div className="flex flex-col gap-2">
        {items.map((def) => {
          const Icon = TAB_ICONS[def.id]
          return (
            <Link
              key={def.id}
              href={def.href}
              className="pressable flex min-h-[56px] items-center gap-3 rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--subtle)]">
                <Icon size={20} className="text-[var(--ink)]" />
              </span>
              <span className="flex-1 text-sm font-bold text-[var(--ink)]">{t(locale, def.i18nKey)}</span>
              <ChevronRight size={18} className="text-[var(--faint)]" />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
```

Note: the More rows now use `nav.assets` / `nav.manage` (via `def.i18nKey`) instead of `more.assets` / `more.manage`. The `more.*` keys remain used by nothing else new; leave them in the dictionary.

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS — no type errors, no lint errors.

- [ ] **Step 6: Verify the default renders unchanged**

Run: `npm run dev`, open `http://localhost:3000`. With `tab_order = NULL`, the bar must show Home · Expenses · Fund · Budget · More, active states correct as you navigate (incl. `/personal` highlighting Home, `/assets` & `/manage` highlighting More). Stop the dev server.

- [ ] **Step 7: Commit**

```bash
git add src/components/nav/tab-icons.ts src/components/nav/BottomTabBar.tsx src/app/\(app\)/layout.tsx src/app/\(app\)/more/page.tsx
git commit -m "feat(nav): render bottom bar and More page from user layout"
```

---

### Task 5: `updateTabOrder` server action

**Files:**
- Modify: `src/app/(app)/settings/actions.ts`

**Interfaces:**
- Consumes: `NavLayout`, `parseLayout` from Task 1.
- Produces: `async function updateTabOrder(layout: NavLayout): Promise<{ ok: boolean; error?: string }>`.

- [ ] **Step 1: Add the action**

In `src/app/(app)/settings/actions.ts`, add the import near the other imports:

```ts
import { parseLayout, type NavLayout } from '@/lib/nav/nav-shared'
```

Then add this exported action (place it right after `updateLanguage`):

```ts
export async function updateTabOrder(layout: NavLayout): Promise<{ ok: boolean; error?: string }> {
  const clean = parseLayout(layout) // normalize + validate; never trust the client
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'not_authenticated' }
  const { error } = await supabase.from('profiles').update({ tab_order: clean }).eq('id', user.id)
  if (error) { console.error('updateTabOrder:', error.message); return { ok: false, error: 'save_failed' } }
  revalidatePath('/', 'layout') // re-render the live BottomTabBar app-wide
  return { ok: true }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/settings/actions.ts
git commit -m "feat(settings): updateTabOrder server action"
```

---

### Task 6: Settings editor (`NavOrderEditor`)

**Files:**
- Create: `src/app/(app)/settings/NavOrderEditor.tsx`
- Modify: `src/lib/data/settings-shared.ts` (add `tabOrder` to `SettingsData`)
- Modify: `src/lib/data/settings.ts` (populate `tabOrder`)
- Modify: `src/app/(app)/settings/SettingsView.tsx` (render the section)

**Interfaces:**
- Consumes: `NavLayout`, `TAB_DEFS`, `MAX_BAR`, `type TabId` from Task 1; `TAB_ICONS` from Task 4; `updateTabOrder` from Task 5; `settings.nav.*` keys from Task 2; `Membership.tabOrder` from Task 3.
- Produces: `SettingsData.tabOrder: NavLayout`; `<NavOrderEditor initial={layout} />`.

- [ ] **Step 1: Add tabOrder to SettingsData**

In `src/lib/data/settings-shared.ts`, add the import and field:

```ts
import type { NavLayout } from '@/lib/nav/nav-shared'
```

Add `tabOrder: NavLayout` to the `SettingsData` type:

```ts
export type SettingsData = {
  members: MemberRow[]
  language: 'en' | 'zh'
  reminders: { monthly: boolean; yearly: boolean }
  pushSubscribed: boolean
  tabOrder: NavLayout
}
```

- [ ] **Step 2: Populate tabOrder in getSettingsData**

In `src/lib/data/settings.ts`, add `tabOrder: m.tabOrder` to the returned object (the `m` membership already carries it):

```ts
  return {
    members,
    language: m.language,
    reminders: {
      monthly: remMap.get('monthly_commitment') ?? true, // default ON
      yearly: remMap.get('yearly_big_payment') ?? true,   // default ON
    },
    pushSubscribed: (subCount ?? 0) > 0,
    tabOrder: m.tabOrder,
  }
```

- [ ] **Step 3: Create the NavOrderEditor component**

Create `src/app/(app)/settings/NavOrderEditor.tsx`:

```tsx
'use client'
import { useState, useTransition } from 'react'
import { ArrowUp, ArrowDown, PanelBottom, PanelBottomDashed } from 'lucide-react'
import { useT } from '@/i18n/LocaleProvider'
import { MAX_BAR, TAB_DEFS, type NavLayout, type TabId } from '@/lib/nav/nav-shared'
import { TAB_ICONS } from '@/components/nav/tab-icons'
import { updateTabOrder } from './actions'

function labelFor(id: TabId): string {
  return TAB_DEFS.find((d) => d.id === id)!.i18nKey
}

export function NavOrderEditor({ initial }: { initial: NavLayout }) {
  const t = useT()
  const [layout, setLayout] = useState<NavLayout>(initial)
  const [, startTransition] = useTransition()

  function apply(next: NavLayout) {
    setLayout(next) // optimistic
    startTransition(() => { updateTabOrder(next) })
  }

  function move(list: 'bar' | 'more', index: number, dir: -1 | 1) {
    const arr = [...layout[list]]
    const j = index + dir
    if (j < 0 || j >= arr.length) return
    ;[arr[index], arr[j]] = [arr[j], arr[index]]
    apply({ ...layout, [list]: arr })
  }

  function toMore(index: number) {
    if (layout.bar.length <= 1) return // keep at least one bar tab
    const bar = [...layout.bar]
    const [id] = bar.splice(index, 1)
    apply({ bar, more: [id, ...layout.more] })
  }

  function toBar(index: number) {
    if (layout.bar.length >= MAX_BAR) return
    const more = [...layout.more]
    const [id] = more.splice(index, 1)
    apply({ bar: [...layout.bar, id], more })
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-semibold text-[var(--muted)]">{t('settings.nav.desc')}</p>

      <Group title={t('settings.nav.inBar')}>
        {layout.bar.map((id, i) => (
          <Row key={id} id={id} label={t(labelFor(id))}>
            <IconBtn label={t('settings.nav.moveUp')} disabled={i === 0} onClick={() => move('bar', i, -1)}><ArrowUp size={16} /></IconBtn>
            <IconBtn label={t('settings.nav.moveDown')} disabled={i === layout.bar.length - 1} onClick={() => move('bar', i, 1)}><ArrowDown size={16} /></IconBtn>
            <IconBtn label={t('settings.nav.toMore')} disabled={layout.bar.length <= 1} onClick={() => toMore(i)}><PanelBottomDashed size={16} /></IconBtn>
          </Row>
        ))}
      </Group>

      <Group title={t('settings.nav.inMore')}>
        {layout.more.map((id, i) => (
          <Row key={id} id={id} label={t(labelFor(id))}>
            <IconBtn label={t('settings.nav.moveUp')} disabled={i === 0} onClick={() => move('more', i, -1)}><ArrowUp size={16} /></IconBtn>
            <IconBtn label={t('settings.nav.moveDown')} disabled={i === layout.more.length - 1} onClick={() => move('more', i, 1)}><ArrowDown size={16} /></IconBtn>
            <IconBtn label={t('settings.nav.toBar')} disabled={layout.bar.length >= MAX_BAR} onClick={() => toBar(i)}><PanelBottom size={16} /></IconBtn>
          </Row>
        ))}
      </Group>
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--faint)]">{title}</p>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  )
}

function Row({ id, label, children }: { id: TabId; label: string; children: React.ReactNode }) {
  const Icon = TAB_ICONS[id]
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2">
      <Icon size={18} className="text-[var(--ink)]" />
      <span className="flex-1 text-sm font-bold text-[var(--ink)]">{label}</span>
      <div className="flex items-center gap-1">{children}</div>
    </div>
  )
}

function IconBtn({ label, disabled, onClick, children }: {
  label: string; disabled?: boolean; onClick: () => void; children: React.ReactNode
}) {
  return (
    <button
      type="button" aria-label={label} disabled={disabled} onClick={onClick}
      className="pressable-opacity grid h-9 w-9 place-items-center rounded-lg border border-[var(--hairline)] text-[var(--muted)] disabled:opacity-30"
    >
      {children}
    </button>
  )
}
```

- [ ] **Step 4: Render the editor in SettingsView**

In `src/app/(app)/settings/SettingsView.tsx`, add the import at the top (with the other local imports):

```tsx
import { NavOrderEditor } from './NavOrderEditor'
```

Then add a new `Section` immediately after the closing `</Section>` of the Language block (before the Notifications `Section`):

```tsx
        {/* Navigation */}
        <Section title={t('settings.nav')}>
          <NavOrderEditor initial={data.tabOrder} />
        </Section>
```

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 6: Manual end-to-end verification**

Run: `npm run dev`, open `http://localhost:3000/settings`. In the Navigation section:
1. Move `Assets` to the bar → the bottom bar updates to show Assets before the More tab (after `revalidatePath`), and Assets disappears from the More page.
2. Verify "move to bar" is disabled once the bar holds 4 items.
3. Verify the last remaining "In bar" item's "move to More" button is disabled.
4. Reorder within the bar with the up/down arrows → order updates live.
5. Reload the page → the layout persists (read back from `profiles.tab_order`).

Stop the dev server.

- [ ] **Step 7: Run the full test suite**

Run: `npm test`
Expected: PASS — all tests green (nav-shared, dictionaries parity, existing suites).

- [ ] **Step 8: Commit**

```bash
git add src/app/\(app\)/settings/NavOrderEditor.tsx src/lib/data/settings-shared.ts src/lib/data/settings.ts src/app/\(app\)/settings/SettingsView.tsx
git commit -m "feat(settings): navigation reorder editor"
```

---

## Notes for the implementer

- **Icon choices:** `assets → LayoutGrid`, `manage → SlidersHorizontal`, and the pinned More tab → `MoreHorizontal`. This deliberately changes the More tab's icon from the old `LayoutGrid` so it doesn't collide with Assets when Assets is promoted into the bar.
- **Why server-side layout:** resolving the layout in `getMembership()` (server) and passing it as a prop avoids any client-side flash of the default bar before the user's saved order loads.
- **Trust boundary:** `updateTabOrder` re-runs `parseLayout` on the incoming value — the client is never trusted to send a valid/complete layout.
- **`more.*` i18n keys** (`more.assets`, `more.manage`) become unused by the More page but are left in place (harmless, and removing them would need a parity re-check).
```
