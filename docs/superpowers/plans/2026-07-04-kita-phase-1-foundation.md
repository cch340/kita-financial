# Kita — Phase 1: Foundation & Data Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a running Next.js PWA shell styled with Kita's design tokens, backed by a cloud Supabase project with the full schema + Row Level Security, seeded from the existing `Financial Report 2026.xlsx`, with email+password auth and the shared primitives (currency formatter, i18n) that every later screen depends on.

**Architecture:** Next.js (App Router, TypeScript) frontend on Vercel; Supabase (cloud) for Postgres + Auth. All data rows are scoped to a `household_id` and protected by RLS so a user only ever sees their own household's rows. Design tokens from the Kita handoff are encoded as CSS custom properties consumed via Tailwind. Pure logic (currency, i18n lookup) is unit-tested with Vitest; schema/RLS/seed are verified with SQL queries.

**Tech Stack:** Next.js (latest, App Router) · TypeScript · Tailwind CSS v4 · `@supabase/ssr` + `@supabase/supabase-js` · `next-intl` (i18n) · `lucide-react` (icons) · Vitest (unit tests) · Python 3 + openpyxl (one-off seed generation, already installed).

## Global Constraints

- **Currency:** always `RM 1,234.56` — `RM ` + `toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})`. Store money as integer **cents**; format at the edge.
- **Languages:** `en` and `zh` only; per-user preference in `profiles.language` (default `en`). Font stack must include CJK: `'Public Sans','Noto Sans SC',system-ui,sans-serif`.
- **Colors are OKLCH** (source of truth); keep as `oklch()` in CSS. Terracotta primary `oklch(0.63 0.14 40)`.
- **Data isolation:** every finance table carries `household_id`; **RLS enabled on every table**, policy keyed on membership in `household_members`. No cross-household reads/writes.
- **Currency scope:** MYR only (no multi-currency).
- **Auth:** Supabase email + password; sessions persisted (stay logged in).
- **Mobile-first PWA:** min tap target 44px; bottom tab bar 84px (incl. 24px safe-area); respect safe-area insets; widths ~360–430px.
- **Members:** exactly two seeded — `CH` (owner) and `JC` (member); one household.
- **Package manager:** npm. **No Docker / no local Supabase** — use the cloud project directly.

---

## Phase Roadmap (context for this plan)

This is Phase 1 of a 6-phase build. Each phase ships working, testable software.

| Phase | Delivers | Screens (handoff IDs) |
|---|---|---|
| **1 (this plan)** | Scaffold, tokens, Supabase schema+RLS, xlsx seed, auth, currency+i18n primitives, app shell | app shell + bottom tabs |
| 2 | Core daily flow | Home `1A`, Add Expense `2A`, Expenses `2B` |
| 3 | Fund & Budget | `2C`, `2D` |
| 4 | Assets + Personal | `3A`–`3E`, `3F` |
| 5 | Settings + Notifications + PWA push | `3G`, `3H`, cron, web push, manifest, SW |
| 6 | Deploy & verify on phones | — |

Phases 2–6 get their own just-in-time plans, each informed by Phase 1's established patterns (Supabase client helpers, token classes, `t()`, currency helper, RLS query shape).

---

## File Structure (Phase 1)

```
financial-tracker-webapp/
├─ package.json, tsconfig.json, next.config.ts, vitest.config.ts
├─ .env.local                      # Supabase keys (gitignored)
├─ .env.example                    # documents required env vars
├─ public/
│  ├─ fonts note (loaded via next/font)
│  └─ icons/ (kita-icon-*.png copied from design_handoff_kita/logo)
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx                # root: fonts, <html lang>, providers
│  │  ├─ globals.css               # design tokens (CSS vars) + Tailwind
│  │  ├─ (auth)/login/page.tsx     # email+password sign-in
│  │  ├─ (app)/layout.tsx          # authed shell: bottom tab bar, safe areas
│  │  ├─ (app)/page.tsx            # Home placeholder
│  │  ├─ (app)/expenses/page.tsx   # placeholder
│  │  ├─ (app)/fund/page.tsx       # placeholder
│  │  ├─ (app)/budget/page.tsx     # placeholder
│  │  └─ (app)/assets/page.tsx     # placeholder
│  ├─ components/
│  │  └─ nav/BottomTabBar.tsx      # 5-tab fixed bar
│  ├─ lib/
│  │  ├─ money.ts                  # formatRM, centsAccumulator helpers
│  │  ├─ money.test.ts
│  │  ├─ supabase/client.ts        # browser client
│  │  ├─ supabase/server.ts        # server client (cookies)
│  │  └─ supabase/middleware.ts    # session refresh
│  ├─ i18n/
│  │  ├─ dictionaries.ts           # en + zh key maps
│  │  ├─ dictionaries.test.ts
│  │  └─ index.ts                  # getDictionary, t()
│  └─ middleware.ts                # auth gate + session refresh
├─ supabase/
│  ├─ migrations/
│  │  ├─ 0001_schema.sql           # all tables
│  │  └─ 0002_rls.sql              # enable RLS + policies
│  └─ seed/
│     ├─ generate_seed.py          # xlsx -> seed.sql
│     └─ seed.sql                  # generated INSERTs (committed)
└─ docs/superpowers/... (spec + this plan)
```

---

## Task 1: Scaffold Next.js app + tooling

**Files:**
- Create: whole project scaffold (via `create-next-app`), `vitest.config.ts`, `.env.example`
- Modify: `package.json` (add deps + scripts)

**Interfaces:**
- Produces: a runnable Next.js app (`npm run dev`), Vitest runner (`npm test`), and installed deps (`@supabase/ssr`, `@supabase/supabase-js`, `next-intl`, `lucide-react`) that every later task imports.

- [ ] **Step 1: Scaffold the app into the current (non-empty) directory**

The repo already contains `docs/`, `tmp/`, `design_handoff_kita/`. Scaffold into a temp dir, then move files in to avoid `create-next-app` refusing a non-empty dir.

```bash
cd /Users/chongchoonhong/Documents/workspace/financial-tracker-webapp
npx create-next-app@latest .kita-scaffold \
  --typescript --tailwind --eslint --app --src-dir \
  --import-alias "@/*" --use-npm --no-turbopack --yes
# move scaffold into project root (including dotfiles), then clean up
shopt -s dotglob
mv .kita-scaffold/* .
rm -rf .kita-scaffold
shopt -u dotglob
```

- [ ] **Step 2: Add runtime + test dependencies**

```bash
npm install @supabase/ssr @supabase/supabase-js next-intl lucide-react
npm install -D vitest @vitejs/plugin-react jsdom
```

- [ ] **Step 3: Add Vitest config and test script**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', globals: true },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
})
```

Add to `package.json` `"scripts"`: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 4: Create `.env.example`**

```bash
cat > .env.example <<'EOF'
# Supabase (from Project Settings → API)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
# Server-only (never expose to client) — used by seed + future cron
SUPABASE_SERVICE_ROLE_KEY=
EOF
```

Confirm `.env*.local` is gitignored (create-next-app adds `.env*` — verify `.gitignore` contains `.env*.local`).

- [ ] **Step 5: Verify dev server + test runner boot**

Run: `npm run dev` → visit `http://localhost:3000` → default Next page renders. Ctrl-C.
Run: `npm test` → Expected: "No test files found" (exit 0) — runner works.

- [ ] **Step 6: Initialize git and commit**

```bash
git init
git add -A
git commit -m "chore: scaffold Next.js + Tailwind + Vitest + Supabase deps"
```

---

## Task 2: Design tokens (Kita) → CSS + Tailwind

**Files:**
- Modify: `src/app/globals.css` (token variables + base)
- Modify: `src/app/layout.tsx` (fonts + `lang`/theme)
- Create: `src/app/(app)/_tokens-preview/page.tsx` (temporary visual check, deleted at end)

**Interfaces:**
- Produces: CSS custom properties `--paper, --surface, --ink, --muted, --primary, --primary-btn, --positive*, --pending*, --info*, --danger, --hairline` (+ dark overrides) and utility classes usable as `bg-[var(--surface)] text-[var(--ink)]`. Font family stack applied globally.

- [ ] **Step 1: Write token variables into `globals.css`**

Keep the create-next-app `@import "tailwindcss";` line at top, then append (OKLCH values verbatim from handoff):

```css
:root {
  --paper: oklch(0.972 0.013 74);
  --paper-2: oklch(0.982 0.011 78);
  --surface: oklch(0.995 0.006 78);
  --subtle: oklch(0.97 0.01 74);
  --hairline: oklch(0.90 0.012 66);
  --ink: oklch(0.30 0.02 50);
  --ink-head: oklch(0.32 0.03 45);
  --muted: oklch(0.55 0.02 58);
  --faint: oklch(0.62 0.02 60);
  --primary: oklch(0.63 0.14 40);
  --primary-btn: oklch(0.61 0.15 39);
  --peach: oklch(0.90 0.055 62);
  --positive-text: oklch(0.50 0.09 155);
  --positive-bg: oklch(0.94 0.04 155);
  --pending-text: oklch(0.64 0.11 65);
  --pending-bg: oklch(0.95 0.05 78);
  --info-text: oklch(0.58 0.09 238);
  --info-bg: oklch(0.93 0.03 235);
  --danger: oklch(0.57 0.16 25);
  --member-ch: oklch(0.70 0.11 42);
  --member-jc: oklch(0.58 0.09 238);
  --hero-grad: linear-gradient(150deg, oklch(0.71 0.115 52), oklch(0.58 0.15 38));
}
:root[data-theme="dark"] {
  --paper: oklch(0.225 0.018 55);
  --paper-2: oklch(0.225 0.018 55);
  --surface: oklch(0.28 0.018 52);
  --ink: oklch(0.95 0.012 78);
  --ink-head: oklch(0.95 0.012 78);
  --muted: oklch(0.68 0.02 60);
  --hairline: oklch(0.34 0.02 55);
}
html, body {
  background: var(--paper);
  color: var(--ink);
  font-family: 'Public Sans','Noto Sans SC',system-ui,sans-serif;
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 2: Load fonts in `layout.tsx`**

Use `next/font/google` for Public Sans + Noto Sans SC; set `<html lang="en" data-theme="light">` and apply the font variable class to `<body>`.

```tsx
import { Public_Sans, Noto_Sans_SC } from 'next/font/google'
const publicSans = Public_Sans({ subsets: ['latin'], weight: ['400','500','600','700','800'], variable: '--font-sans' })
const notoSC = Noto_Sans_SC({ subsets: ['latin'], weight: ['400','500','700'], variable: '--font-cjk' })
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" className={`${publicSans.variable} ${notoSC.variable}`}>
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 3: Temporary token preview page**

Create `src/app/(app)/_tokens-preview/page.tsx` rendering swatches for `--paper, --surface, --primary, --positive-bg, --pending-bg, --info-bg` and a hero div using `background: var(--hero-grad)`.

- [ ] **Step 4: Verify visually**

Run: `npm run dev` → open `/(_tokens-preview)` route `http://localhost:3000/_tokens-preview`.
Expected: cream background, terracotta swatch, sage/amber/blue tiles, terracotta hero gradient; toggling `document.documentElement.dataset.theme='dark'` in devtools flips to warm dark.

- [ ] **Step 5: Delete preview page and commit**

```bash
rm -rf src/app/\(app\)/_tokens-preview
git add -A
git commit -m "feat: Kita design tokens (OKLCH) + fonts"
```

---

## Task 3: Currency helper (`money.ts`) — TDD

**Files:**
- Create: `src/lib/money.ts`, `src/lib/money.test.ts`

**Interfaces:**
- Produces:
  - `formatRM(cents: number): string` → `"RM 1,234.56"`
  - `pushDigit(cents: number, digit: number): number` → `cents*10 + digit`
  - `pushDoubleZero(cents: number): number` → `cents*100`
  - `backspace(cents: number): number` → `Math.floor(cents/10)`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { formatRM, pushDigit, pushDoubleZero, backspace } from './money'

describe('formatRM', () => {
  it('formats cents as RM with grouping and 2dp', () => {
    expect(formatRM(123456)).toBe('RM 1,234.56')
    expect(formatRM(0)).toBe('RM 0.00')
    expect(formatRM(5)).toBe('RM 0.05')
    expect(formatRM(227000)).toBe('RM 2,270.00')
  })
})
describe('cents accumulator', () => {
  it('pushDigit shifts left and adds', () => {
    expect(pushDigit(0, 4)).toBe(4)
    expect(pushDigit(4, 2)).toBe(42)     // 0.42
    expect(pushDigit(425, 0)).toBe(4250) // 42.50
  })
  it('pushDoubleZero multiplies by 100', () => {
    expect(pushDoubleZero(42)).toBe(4200)
  })
  it('backspace divides by 10 (floor)', () => {
    expect(backspace(4250)).toBe(425)
    expect(backspace(4)).toBe(0)
    expect(backspace(0)).toBe(0)
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test` → Expected: FAIL (`formatRM` not exported / module not found).

- [ ] **Step 3: Implement `money.ts`**

```ts
export function formatRM(cents: number): string {
  const value = cents / 100
  return 'RM ' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
export const pushDigit = (cents: number, digit: number): number => cents * 10 + digit
export const pushDoubleZero = (cents: number): number => cents * 100
export const backspace = (cents: number): number => Math.floor(cents / 10)
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test` → Expected: PASS (all money tests green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/money.ts src/lib/money.test.ts
git commit -m "feat: RM currency formatter + cents accumulator (tested)"
```

---

## Task 4: i18n scaffold (`en`/`zh`) — TDD

**Files:**
- Create: `src/i18n/dictionaries.ts`, `src/i18n/index.ts`, `src/i18n/dictionaries.test.ts`

**Interfaces:**
- Produces:
  - `type Locale = 'en' | 'zh'`
  - `dictionaries: Record<Locale, Record<string,string>>`
  - `t(locale: Locale, key: string): string` — returns the string, falling back to `en`, then to the key itself.

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { t } from './index'

describe('t()', () => {
  it('returns the localized string', () => {
    expect(t('en', 'nav.home')).toBe('Home')
    expect(t('zh', 'nav.home')).toBe('首页')
  })
  it('falls back to en when zh key missing', () => {
    expect(t('zh', 'test.only_en')).toBe('English only')
  })
  it('falls back to the key when unknown', () => {
    expect(t('en', 'does.not.exist')).toBe('does.not.exist')
  })
})
```

- [ ] **Step 2: Run to verify fail**

Run: `npm test` → Expected: FAIL (`./index` not found).

- [ ] **Step 3: Implement dictionaries + `t()`**

`src/i18n/dictionaries.ts`:

```ts
export type Locale = 'en' | 'zh'
export const dictionaries: Record<Locale, Record<string, string>> = {
  en: {
    'nav.home': 'Home', 'nav.expenses': 'Expenses', 'nav.fund': 'Fund',
    'nav.budget': 'Budget', 'nav.assets': 'Assets',
    'auth.signin': 'Sign in', 'auth.email': 'Email', 'auth.password': 'Password',
    'test.only_en': 'English only',
  },
  zh: {
    'nav.home': '首页', 'nav.expenses': '开支', 'nav.fund': '共同基金',
    'nav.budget': '预算', 'nav.assets': '资产',
    'auth.signin': '登录', 'auth.email': '电子邮件', 'auth.password': '密码',
  },
}
```

`src/i18n/index.ts`:

```ts
import { dictionaries, type Locale } from './dictionaries'
export type { Locale }
export function t(locale: Locale, key: string): string {
  return dictionaries[locale]?.[key] ?? dictionaries.en[key] ?? key
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/i18n
git commit -m "feat: i18n dictionaries + t() with en fallback (tested)"
```

---

## Task 5: Supabase project + client helpers

**Files:**
- Create: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/middleware.ts`, `src/middleware.ts`
- Modify: `.env.local` (real keys — manual, not committed)

**Interfaces:**
- Produces:
  - `createBrowserClient()` (client components) — `createClient()` in `client.ts`
  - `createServerClient()` (server components/actions) — `createClient()` in `server.ts`
  - `updateSession(request)` middleware helper for cookie refresh.

- [ ] **Step 1: Create the cloud Supabase project (manual)**

On supabase.com: New Project → name `kita` → strong DB password → region closest to Malaysia (Singapore). When ready, copy from Project Settings → API: `Project URL`, `anon` key, `service_role` key into `.env.local` (mirror `.env.example`). **Do not commit `.env.local`.**

- [ ] **Step 2: Browser client**

`src/lib/supabase/client.ts`:

```ts
import { createBrowserClient } from '@supabase/ssr'
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
```

- [ ] **Step 3: Server client**

`src/lib/supabase/server.ts`:

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => { try { list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {} },
      },
    },
  )
}
```

- [ ] **Step 4: Session middleware helper**

`src/lib/supabase/middleware.ts`:

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    },
  )
  const { data: { user } } = await supabase.auth.getUser()
  return { response, user }
}
```

- [ ] **Step 5: Verify connection**

Add a throwaway server action or a `console.log` in a temporary route that calls `await createClient()` then `supabase.auth.getUser()`; run `npm run dev`; confirm no thrown errors and `user` is `null` (not signed in yet). Remove the throwaway after.

- [ ] **Step 6: Commit (code only, not env)**

```bash
git add src/lib/supabase src/middleware.ts 2>/dev/null; git add src/lib/supabase
git commit -m "feat: Supabase browser/server clients + session helper"
```

---

## Task 6: Database schema migration

**Files:**
- Create: `supabase/migrations/0001_schema.sql`

**Interfaces:**
- Produces tables: `households`, `profiles`, `household_members`, `joint_fund_config`, `joint_fund_contributions`, `budget_categories`, `monthly_commitments`, `expenses`, `ledger_entries`, `assets`, `asset_transactions`, `push_subscriptions`, `reminder_settings`. All money columns are `bigint` **cents**. Enums as `text` + `check`.

- [ ] **Step 1: Write `0001_schema.sql`**

```sql
-- === Sharing / identity ===
create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  base_currency text not null default 'MYR',
  created_at timestamptz not null default now()
);
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  email text not null,
  language text not null default 'en' check (language in ('en','zh')),
  avatar_color text
);
create table household_members (
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  member_code text not null check (member_code in ('CH','JC')),
  primary key (household_id, user_id)
);

-- === Joint Fund ===
create table joint_fund_config (
  household_id uuid not null references households(id) on delete cascade,
  member_code text not null check (member_code in ('CH','JC')),
  expected_monthly_cents bigint not null,
  carry_forward_prev_year_cents bigint not null default 0,
  primary key (household_id, member_code)
);
create table joint_fund_contributions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  member_code text not null check (member_code in ('CH','JC')),
  period date not null,                         -- first of month
  amount_cents bigint not null,
  status text not null default 'pending' check (status in ('paid','pending')),
  notes text
);

-- === Budget ===
create table budget_categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name_en text not null,
  name_zh text,
  jc_cents bigint not null default 0,
  ch_cents bigint not null default 0,
  total_cents bigint not null default 0,
  remark text,
  sort_order int not null default 0
);
create table monthly_commitments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name_en text not null,
  name_zh text,
  amount_cents bigint not null,
  remark text
);

-- === Expenses ===
create table expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  date date not null,
  vendor text,
  location text,
  details text,
  category text,
  amount_cents bigint not null,
  paid_by text check (paid_by in ('CH','JC')),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- === Personal ledgers ===
create table ledger_entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  owner_member_code text not null check (owner_member_code in ('CH','JC')),
  period date not null,
  entry_type text not null check (entry_type in ('income','expense')),
  description text not null,
  amount_cents bigint not null,
  remark text
);

-- === Assets (generic) ===
create table assets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  type text not null check (type in ('property','vehicle','investment','other')),
  name text not null,
  owner_member_code text check (owner_member_code in ('CH','JC')),
  status text not null default 'active' check (status in ('active','closed')),
  opening_balance_cents bigint,
  metadata jsonb not null default '{}',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create table asset_transactions (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references assets(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  date date not null,
  description text,
  amount_cents bigint not null,
  direction text not null check (direction in ('in','out')),
  txn_type text,
  settled boolean not null default false,
  seq int,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- === Notifications ===
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create table reminder_settings (
  user_id uuid not null references profiles(id) on delete cascade,
  reminder_type text not null check (reminder_type in ('monthly_commitment','yearly_big_payment')),
  enabled boolean not null default true,
  primary key (user_id, reminder_type)
);

create index on joint_fund_contributions (household_id, period);
create index on expenses (household_id, date);
create index on ledger_entries (household_id, owner_member_code, period);
create index on asset_transactions (asset_id, date);
```

- [ ] **Step 2: Apply the migration to the cloud DB**

Open Supabase Dashboard → SQL Editor → paste the full contents of `0001_schema.sql` → Run.
Expected: "Success. No rows returned." Verify in Table Editor that all 13 tables exist.

- [ ] **Step 3: Verify programmatically**

In SQL Editor run:

```sql
select table_name from information_schema.tables
where table_schema='public' order by table_name;
```

Expected: 13 rows including `assets`, `asset_transactions`, `expenses`, `households`, `household_members`, `profiles`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0001_schema.sql
git commit -m "feat: database schema (households, assets, expenses, ...) in cents"
```

---

## Task 7: Row Level Security policies

**Files:**
- Create: `supabase/migrations/0002_rls.sql`

**Interfaces:**
- Produces: RLS enabled on every table; a SQL helper `is_member(hh uuid)`; policies that allow a user to read/write only rows for households they belong to (and their own `profiles`/`push_subscriptions`/`reminder_settings`).

- [ ] **Step 1: Write `0002_rls.sql`**

```sql
-- membership helper
create or replace function public.is_member(hh uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from household_members m
    where m.household_id = hh and m.user_id = auth.uid()
  );
$$;

-- enable RLS
alter table households              enable row level security;
alter table profiles                enable row level security;
alter table household_members       enable row level security;
alter table joint_fund_config       enable row level security;
alter table joint_fund_contributions enable row level security;
alter table budget_categories       enable row level security;
alter table monthly_commitments     enable row level security;
alter table expenses                enable row level security;
alter table ledger_entries          enable row level security;
alter table assets                  enable row level security;
alter table asset_transactions      enable row level security;
alter table push_subscriptions      enable row level security;
alter table reminder_settings       enable row level security;

-- households: members can read; owner-only handled at app layer
create policy hh_read on households for select using (is_member(id));

-- household_members: a user sees rows of households they belong to
create policy hm_read on household_members for select using (is_member(household_id));

-- profiles: a user reads/updates own row, and reads co-members' profiles
create policy prof_self on profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy prof_comembers on profiles for select using (
  exists (select 1 from household_members a
          join household_members b on a.household_id = b.household_id
          where a.user_id = auth.uid() and b.user_id = profiles.id)
);

-- generic household-scoped tables: full CRUD for members
create policy jfc_all  on joint_fund_config        for all using (is_member(household_id)) with check (is_member(household_id));
create policy jfcn_all on joint_fund_contributions for all using (is_member(household_id)) with check (is_member(household_id));
create policy bc_all   on budget_categories        for all using (is_member(household_id)) with check (is_member(household_id));
create policy mc_all   on monthly_commitments      for all using (is_member(household_id)) with check (is_member(household_id));
create policy exp_all  on expenses                 for all using (is_member(household_id)) with check (is_member(household_id));
create policy led_all  on ledger_entries           for all using (is_member(household_id)) with check (is_member(household_id));
create policy ast_all  on assets                   for all using (is_member(household_id)) with check (is_member(household_id));
create policy atx_all  on asset_transactions       for all using (is_member(household_id)) with check (is_member(household_id));

-- per-user notification tables
create policy push_self  on push_subscriptions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy rem_self   on reminder_settings  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
```

- [ ] **Step 2: Apply to cloud DB**

Supabase SQL Editor → paste `0002_rls.sql` → Run. Expected: Success.

- [ ] **Step 3: Verify RLS is on**

```sql
select relname, relrowsecurity from pg_class
where relname in ('expenses','assets','profiles') ;
```

Expected: `relrowsecurity = true` for all three.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0002_rls.sql
git commit -m "feat: RLS policies (household-scoped isolation)"
```

---

## Task 8: Seed from the spreadsheet

**Files:**
- Create: `supabase/seed/generate_seed.py`, `supabase/seed/seed.sql` (generated + committed)

**Interfaces:**
- Consumes: `tmp/Financial Report 2026.xlsx`, and the two auth user UUIDs (created in Task 9 Step 1 — see note).
- Produces: `seed.sql` inserting one household, two `household_members` (CH owner, JC member), `joint_fund_config`, and rows for `joint_fund_contributions`, `budget_categories`, `monthly_commitments`, `expenses`, `ledger_entries`, `assets` (TreeO/Myvi/Alza/AIA-CH/AIA-JC), and `asset_transactions`.

> **Ordering note:** `profiles.id` must equal `auth.users.id`, so the two auth users must exist first. Task 9 Step 1 creates them and records their UUIDs; run this task's Step 3 (generate) and Step 4 (apply) **after** those UUIDs are known. Placeholders `:CH_UID` / `:JC_UID` are substituted at apply time.

- [ ] **Step 1: Write `generate_seed.py`**

The script reads the xlsx (money → cents = round(value*100)), and prints SQL to stdout. It emits a fixed household UUID and uses `:CH_UID` / `:JC_UID` placeholders for member/profile references.

```python
#!/usr/bin/env python3
import openpyxl, sys, datetime
HH = '00000000-0000-0000-0000-0000000000aa'  # fixed household id
wb = openpyxl.load_workbook('tmp/Financial Report 2026.xlsx', data_only=True)
out = []
def c(v):  # to cents
    return 0 if v is None else round(float(v) * 100)
def s(v):  # sql string literal or NULL
    return 'NULL' if v is None else "'" + str(v).replace("'", "''") + "'"
def d(v):  # date literal
    if isinstance(v, (datetime.datetime, datetime.date)):
        return "'" + v.strftime('%Y-%m-%d') + "'"
    return 'NULL'

out.append(f"insert into households(id,name) values ('{HH}','Chong Family');")
out.append(f"insert into household_members(household_id,user_id,role,member_code) values"
           f" ('{HH}',:CH_UID,'owner','CH'),('{HH}',:JC_UID,'member','JC');")

# Joint Fund config (from Money breakdown Total Per Person: CH 2270, JC 2470) + carry-forward
out.append(f"insert into joint_fund_config(household_id,member_code,expected_monthly_cents,carry_forward_prev_year_cents) values"
           f" ('{HH}','CH',227000,0),('{HH}','JC',247000,133853);")

# Joint Fund contributions — two columns in 'Joint Fund' sheet
jf = wb['Joint Fund']
for col_date, col_amt, col_status, member in [(1,2,3,'CH'), (7,8,9,'JC')]:
    for r in range(3, 15):
        dt = jf.cell(r, col_date).value
        amt = jf.cell(r, col_amt).value
        st = jf.cell(r, col_status).value
        if dt is None or amt is None: continue
        status = 'paid' if st is True else 'pending'
        out.append(f"insert into joint_fund_contributions(household_id,member_code,period,amount_cents,status) "
                   f"values ('{HH}','{member}',{d(dt)},{c(amt)},'{status}');")

# Budget categories — 'Money breakdown' rows 2..8 (Category, JC, CH, Total)
mb = wb['Money breakdown']
order = 0
for r in range(2, 9):
    name = mb.cell(r,1).value
    if not name: continue
    order += 1
    out.append(f"insert into budget_categories(household_id,name_en,jc_cents,ch_cents,total_cents,remark,sort_order) "
               f"values ('{HH}',{s(name)},{c(mb.cell(r,2).value)},{c(mb.cell(r,3).value)},"
               f"{c(mb.cell(r,4).value)},{s(mb.cell(r,5).value)},{order});")

# Monthly commitments — 'Money breakdown' second table rows 2..9 (cols 7,8,9)
for r in range(2, 10):
    name = mb.cell(r,7).value
    amt = mb.cell(r,8).value
    if not name or amt is None: continue
    out.append(f"insert into monthly_commitments(household_id,name_en,amount_cents,remark) "
               f"values ('{HH}',{s(name)},{c(amt)},{s(mb.cell(r,9).value)});")

# Expenses — 'Expenses' sheet (Date,Vendor,Location,Details,Amount)
ex = wb['Expenses']
for r in range(2, ex.max_row + 1):
    amt = ex.cell(r,5).value
    if amt is None: continue
    out.append(f"insert into expenses(household_id,date,vendor,location,details,amount_cents,paid_by) "
               f"values ('{HH}',{d(ex.cell(r,1).value)},{s(ex.cell(r,2).value)},{s(ex.cell(r,3).value)},"
               f"{s(ex.cell(r,4).value)},{c(amt)},NULL);")

# Assets: TreeO (property), Myvi/Alza (vehicle), AIA-CH/AIA-JC (investment)
def asset(idlit, typ, name, owner, opening):
    owner_sql = 'NULL' if owner is None else f"'{owner}'"
    open_sql = 'NULL' if opening is None else str(opening)
    out.append(f"insert into assets(id,household_id,type,name,owner_member_code,opening_balance_cents) "
               f"values ('{idlit}','{HH}','{typ}',{s(name)},{owner_sql},{open_sql});")
A_TREEO='00000000-0000-0000-0000-0000000000b1'
A_MYVI ='00000000-0000-0000-0000-0000000000b2'
A_ALZA ='00000000-0000-0000-0000-0000000000b3'
A_AIACH='00000000-0000-0000-0000-0000000000b4'
A_AIAJC='00000000-0000-0000-0000-0000000000b5'
# TreeO opening balance = carry-forward from 2025 (TreeO sheet R2 = 46013.81)
asset(A_TREEO,'property','TreeO',None,4601381)
asset(A_MYVI ,'vehicle','Myvi PQC 9059',None,None)
asset(A_ALZA ,'vehicle','Alza PNM 9059',None,None)
asset(A_AIACH,'investment','AIA — CH','CH',None)
asset(A_AIAJC,'investment','AIA — JC','JC',None)

# TreeO transactions — 'TreeO' sheet rows 3..18 (Date,Details,Amount,Transferred)
to = wb['TreeO']
for r in range(3, 19):
    det = to.cell(r,2).value; amt = to.cell(r,3).value
    if amt is None: continue
    transferred = to.cell(r,4).value is True
    direction = 'in' if 'Commitment' in str(det) else 'out'
    txn_type = 'monthly_commitment' if direction=='in' else 'bill'
    out.append(f"insert into asset_transactions(asset_id,household_id,date,description,amount_cents,direction,txn_type,settled) "
               f"values ('{A_TREEO}','{HH}',{d(to.cell(r,1).value)},{s(det)},{c(amt)},'{direction}','{txn_type}',{str(transferred).lower()});")

# AIA schedules — 'AIA Investment' rows 3..12 (seq col1, CH date/amt col2/3, JC date/amt col5/6)
aia = wb['AIA Investment']
for r in range(3, 13):
    seq = aia.cell(r,1).value
    if seq is None: continue
    seq = int(seq)
    for dcol, acol, aid in [(2,3,A_AIACH),(5,6,A_AIAJC)]:
        amt = aia.cell(r,acol).value
        if amt is None: continue
        out.append(f"insert into asset_transactions(asset_id,household_id,date,description,amount_cents,direction,txn_type,settled,seq) "
                   f"values ('{aid}','{HH}',{d(aia.cell(r,dcol).value)},'AIA payment',{c(amt)},'out','scheduled_payment',true,{seq});")

# Personal ledgers — CH & JC sheets have repeating monthly blocks; seed CH month 1 income/expense as representative.
# (Full monthly parsing deferred to Phase 4; seed at least Jan for CH and JC so the screen renders.)
print('\n'.join(out))
```

- [ ] **Step 2: Generate `seed.sql`**

```bash
python3 supabase/seed/generate_seed.py > supabase/seed/seed.sql
head -20 supabase/seed/seed.sql   # sanity check the INSERTs
```

Expected: valid `insert into ...` lines; money as integer cents (e.g. `227000`).

- [ ] **Step 3: Substitute the auth UUIDs (after Task 9 Step 1)**

Once the two auth users exist and their UUIDs are known:

```bash
sed -e "s/:CH_UID/'<CH-user-uuid>'/g" -e "s/:JC_UID/'<JC-user-uuid>'/g" \
  supabase/seed/seed.sql > supabase/seed/seed.applied.sql
```

- [ ] **Step 4: Apply the seed**

Supabase SQL Editor → paste `seed.applied.sql` (which also needs `profiles` rows — insert those in Task 9 Step 2 first, since `household_members.user_id` → `profiles.id`). Run.
Expected: Success. Then verify:

```sql
select (select count(*) from expenses) as expenses,
       (select count(*) from assets) as assets,
       (select count(*) from joint_fund_contributions) as contribs;
```

Expected: expenses > 30, assets = 5, contribs = 24.

- [ ] **Step 5: Commit (generator + generated seed; NOT the applied file with UIDs)**

```bash
echo "supabase/seed/seed.applied.sql" >> .gitignore
git add supabase/seed/generate_seed.py supabase/seed/seed.sql .gitignore
git commit -m "feat: xlsx -> seed.sql generator + generated household seed"
```

---

## Task 9: Auth (email + password) + profiles

**Files:**
- Create: `src/app/(auth)/login/page.tsx`, `src/app/(auth)/login/actions.ts`
- Modify: `src/middleware.ts` (gate unauthenticated users to `/login`)

**Interfaces:**
- Consumes: `createClient()` from `src/lib/supabase/server.ts`, `updateSession` from `src/lib/supabase/middleware.ts`.
- Produces: a working sign-in that sets the session cookie and redirects to `/`; `middleware` that redirects unauthenticated requests to `/login`.

- [ ] **Step 1: Create the two auth users (manual) and record UUIDs**

Supabase Dashboard → Authentication → Users → Add user (email confirmed): create CH (`cch340@gmail.com`) and JC (her email) with passwords. Copy each user's UUID → these are `:CH_UID` / `:JC_UID` for Task 8 Step 3.

- [ ] **Step 2: Insert matching `profiles` rows**

SQL Editor:

```sql
insert into profiles(id,display_name,email,language,avatar_color) values
 ('<CH-user-uuid>','CH','cch340@gmail.com','en','peach'),
 ('<JC-user-uuid>','JC','<jc-email>','en','blue');
```

(Then proceed to run Task 8 Step 4 seed, which references these profiles.)

- [ ] **Step 3: Login server action**

`src/app/(auth)/login/actions.ts`:

```ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
export async function signIn(formData: FormData) {
  const email = String(formData.get('email'))
  const password = String(formData.get('password'))
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) redirect('/login?error=' + encodeURIComponent(error.message))
  redirect('/')
}
```

- [ ] **Step 4: Login page**

`src/app/(auth)/login/page.tsx` — a minimal centered form (Kita tokens): email + password inputs + "Sign in" button posting to `signIn`. Use `bg-[var(--paper)]`, card `bg-[var(--surface)]`, button `bg-[var(--primary-btn)] text-white`.

```tsx
import { signIn } from './actions'
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  return (
    <main className="min-h-dvh grid place-items-center px-6 bg-[var(--paper)]">
      <form action={signIn} className="w-full max-w-sm rounded-2xl bg-[var(--surface)] p-6 shadow">
        <h1 className="text-2xl font-extrabold text-[var(--ink-head)]">Kita.</h1>
        <input name="email" type="email" required placeholder="Email"
          className="mt-4 w-full rounded-xl border border-[var(--hairline)] px-4 py-3" />
        <input name="password" type="password" required placeholder="Password"
          className="mt-3 w-full rounded-xl border border-[var(--hairline)] px-4 py-3" />
        {error && <p className="mt-2 text-sm text-[var(--danger)]">{error}</p>}
        <button className="mt-4 w-full rounded-xl bg-[var(--primary-btn)] py-3 font-semibold text-white">Sign in</button>
      </form>
    </main>
  )
}
```

- [ ] **Step 5: Auth gate middleware**

`src/middleware.ts`:

```ts
import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request)
  const { pathname } = request.nextUrl
  const isAuthRoute = pathname.startsWith('/login')
  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone(); url.pathname = '/login'
    return NextResponse.redirect(url)
  }
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone(); url.pathname = '/'
    return NextResponse.redirect(url)
  }
  return response
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|.*\\.png$).*)'] }
```

- [ ] **Step 6: Verify the full auth loop**

Run `npm run dev`. Visit `/` → redirected to `/login`. Sign in with CH's credentials → redirected to `/` (Home placeholder from Task 10). Refresh → stays logged in. Wrong password → error text shows.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(auth)" src/middleware.ts
git commit -m "feat: email+password auth, profiles, middleware gate"
```

---

## Task 10: Authenticated app shell + bottom tab bar

**Files:**
- Create: `src/app/(app)/layout.tsx`, `src/components/nav/BottomTabBar.tsx`, and placeholder pages `page.tsx` under `(app)`, `(app)/expenses`, `(app)/fund`, `(app)/budget`, `(app)/assets`.

**Interfaces:**
- Consumes: `t()` from `@/i18n`, tokens from `globals.css`.
- Produces: a fixed 5-tab bottom bar (`Home · Expenses · Fund · Budget · Assets`), active-tab highlight in terracotta, safe-area padding; each tab routes to a titled placeholder screen. This is the frame every Phase 2–4 screen fills in.

- [ ] **Step 1: Bottom tab bar component**

`src/components/nav/BottomTabBar.tsx`:

```tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Receipt, HandCoins, ChartColumn, LayoutGrid } from 'lucide-react'
const TABS = [
  { href: '/', label: 'Home', Icon: Home },
  { href: '/expenses', label: 'Expenses', Icon: Receipt },
  { href: '/fund', label: 'Fund', Icon: HandCoins },
  { href: '/budget', label: 'Budget', Icon: ChartColumn },
  { href: '/assets', label: 'Assets', Icon: LayoutGrid },
]
export function BottomTabBar() {
  const path = usePathname()
  return (
    <nav className="fixed inset-x-0 bottom-0 h-[84px] border-t border-[var(--hairline)] bg-[var(--surface)]"
         style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <ul className="mx-auto flex h-[60px] max-w-[430px] items-stretch justify-around">
        {TABS.map(({ href, label, Icon }) => {
          const active = href === '/' ? path === '/' : path.startsWith(href)
          return (
            <li key={href} className="flex-1">
              <Link href={href} className="flex h-full flex-col items-center justify-center gap-1"
                    style={{ color: active ? 'var(--primary)' : 'var(--faint)' }}>
                <Icon size={22} strokeWidth={active ? 2.4 : 2} />
                <span className="text-[10px] font-semibold">{label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
```

- [ ] **Step 2: Authed layout**

`src/app/(app)/layout.tsx`:

```tsx
import { BottomTabBar } from '@/components/nav/BottomTabBar'
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[var(--paper)]">
      <div className="mx-auto max-w-[430px] px-[18px] pb-[96px] pt-4">{children}</div>
      <BottomTabBar />
    </div>
  )
}
```

- [ ] **Step 3: Placeholder pages**

Each of the 5 pages renders a titled placeholder, e.g. `src/app/(app)/page.tsx`:

```tsx
export default function HomePage() {
  return <h1 className="text-2xl font-extrabold text-[var(--ink-head)]">Home</h1>
}
```

Repeat for `expenses/page.tsx` ("Expenses"), `fund/page.tsx` ("Fund"), `budget/page.tsx` ("Budget"), `assets/page.tsx` ("Assets").

- [ ] **Step 4: Verify the shell on a phone viewport**

Run `npm run dev`; in browser devtools set an iPhone viewport. Sign in. Confirm: bottom bar shows 5 tabs; tapping each navigates and highlights the active tab terracotta; content clears the bar; safe-area padding present.

- [ ] **Step 5: Verify data is reachable behind auth**

In a temporary server component, `const { data } = await (await createClient()).from('expenses').select('*').limit(3)` and log length. Confirm ≥1 row returns (RLS allows the signed-in member). Remove the temporary code.

- [ ] **Step 6: Full check + commit**

Run: `npm test` → Expected: PASS (money + i18n suites).
Run: `npm run build` → Expected: build succeeds.

```bash
git add "src/app/(app)" src/components/nav
git commit -m "feat: authed app shell + bottom tab bar + placeholder routes"
```

---

## Phase 1 Done — Definition of Done

- `npm run dev` → visiting any route while signed out redirects to `/login`; signing in as CH lands on Home.
- Bottom tab bar navigates Home/Expenses/Fund/Budget/Assets with terracotta active state on a phone viewport.
- Supabase has all 13 tables with RLS on; seeded with one household, CH+JC members, ~30+ expenses, 5 assets, 24 contributions.
- `npm test` green (currency + i18n); `npm run build` succeeds.
- Design tokens render (cream/terracotta/sage/amber/blue) in light and dark.

Next: **Phase 2 plan** (Home `1A`, Add Expense `2A`, Expenses `2B`) — written just-in-time against these foundations.
