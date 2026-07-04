# Kita Phase 5 — Settings, PWA & Web Push Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Settings screen (3G), make Kita an installable PWA, and add Web Push reminders for monthly commitments + yearly big payments (3H), so CH & JC can install Kita on their phones and get nudged about payments.

**Architecture:** Settings renders as a full-screen container (like the existing AddAssetForm overlay) so no bottom tab bar shows, staying inside the `(app)` group for auth + `LocaleProvider`. PWA uses the Next.js 16 idiom: `app/manifest.ts` (a `MetadataRoute.Manifest` route → served at `/manifest.webmanifest`) + a hand-written `public/sw.js` service worker (no Serwist/webpack — the app is on Turbopack) registered client-side. Web Push uses the `web-push` npm package with VAPID keys; subscriptions persist in the existing `push_subscriptions` table; a protected route handler (`/api/reminders/run`) scans due reminders and sends pushes, to be triggered by Vercel Cron in Phase 6. A new server-only service-role Supabase client (`admin.ts`) is used only where RLS-bypass is genuinely required (lightweight invite = add a co-member; cron = read subscriptions across users).

**Tech Stack:** Next.js 16 (App Router, Server Actions, Route Handlers, Metadata), TypeScript strict, Tailwind v4, Supabase (`@supabase/ssr` + service-role client), `web-push`, `lucide-react`, Vitest.

## Global Constraints

- **Money = integer cents** everywhere; format only via `formatRM` / `MoneyText` as `RM 1,234.56`. (Not directly exercised in this phase but never violate it.)
- **Bilingual EN/中文**: every user-visible string goes through the i18n dictionary. Every `en` key MUST have a matching `zh` key — the `src/i18n/dictionaries.test.ts` locale-parity test enforces this and MUST pass.
- **Client/server boundary**: any module imported by a `'use client'` component must NOT import `@/lib/supabase/server`, `@/lib/supabase/admin`, `next/headers`, or `web-push`. Keep pure logic in `*-shared.ts`. Server-only helpers stay in server modules / actions / route handlers.
- **Household-scoping & trust**: derive `householdId` / `user.id` server-side (`getMembership()` / `supabase.auth.getUser()`); never trust a client-supplied household or user id. Mutations verify ownership.
- **Service-role key is server-only**: `SUPABASE_SERVICE_ROLE_KEY` and `VAPID_PRIVATE_KEY` never reach the client. Only `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is public.
- **App conventions**: CH = peach (`--member-ch`), JC = blue (`--member-jc`); primary = terracotta; design tokens are CSS vars in `globals.css`. Icons = `lucide-react`. Screens are max-width `430px`, 18px padding.
- **Server Action return shape**: `{ ok: boolean; error?: string; ... }` where `error` is an i18n key suffix under `error.*` (matches existing `createAsset`).

---

## File Structure

**Create:**
- `src/app/manifest.ts` — web app manifest (name, icons, standalone, terracotta theme).
- `public/sw.js` — service worker: `push` + `notificationclick` handlers + minimal shell cache.
- `public/icons/kita-icon-192.png`, `kita-icon-512.png`, `kita-icon-maskable-512.png` — copied from `design_handoff_kita/logo/`.
- `src/components/pwa/ServiceWorkerRegistrar.tsx` — `'use client'`; registers `/sw.js` on mount. Mounted once in root layout.
- `src/lib/supabase/admin.ts` — server-only service-role client factory.
- `src/lib/data/settings.ts` — `getSettingsData()` (server; members, language, reminder settings, push-subscribed flag).
- `src/lib/data/settings-shared.ts` — pure types (`SettingsData`, `MemberRow`) + `isValidEmail`.
- `src/app/(app)/settings/page.tsx` — Settings server component (3G).
- `src/app/(app)/settings/SettingsView.tsx` — `'use client'` interactive settings UI.
- `src/app/(app)/settings/actions.ts` — `updateLanguage`, `updateReminderSetting`, `inviteMember`, `signOutAction`, `subscribeToPush`, `unsubscribeFromPush`, `sendTestPush`.
- `src/lib/push/web-push.ts` — server-only `web-push` config + `sendPushToUser(userId, payload)`.
- `src/lib/push/push-shared.ts` — pure `urlBase64ToUint8Array` + `serializeSubscription` (client-safe).
- `src/lib/data/reminders.ts` — pure `dueReminders(today, ctx)` + server `runReminderScan()`.
- `src/lib/data/reminders-shared.ts` — pure types + `dueReminders` (unit-tested).
- `src/app/api/reminders/run/route.ts` — protected GET route handler (Vercel Cron target).
- `src/app/(app)/push-demo/page.tsx` — 3H static push/lock-screen demo.
- Test files: `src/app/manifest.test.ts`, `src/lib/data/settings-shared.test.ts`, `src/lib/push/push-shared.test.ts`, `src/lib/data/reminders-shared.test.ts`, plus additions to `src/lib/money.test.ts`.

**Modify:**
- `src/middleware.ts` — widen matcher to let `/sw.js` and `/manifest.webmanifest` through publicly.
- `next.config.ts` — headers for `/sw.js` (correct content-type + no-cache) + baseline security headers.
- `src/app/layout.tsx` — manifest is auto-linked from `manifest.ts`; add Apple web-app meta + mount `ServiceWorkerRegistrar`.
- `.env.example` — add `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `CRON_SECRET`.
- `src/i18n/dictionaries.ts` — add `settings.*` / `push.*` keys (en+zh); remove 6 dead `asset.status.*` keys.
- `src/lib/money.ts` + `src/lib/money.test.ts` — add tested `parseMoneyInput`.
- `src/app/(app)/assets/new/AddAssetForm.tsx`, `src/app/(app)/expenses/new/*` add-form, `src/app/(app)/personal/*` add-entry form — replace local `toCents` with `parseMoneyInput`.
- `SETUP.md` — Phase 5 section (VAPID keys, Vercel Cron note).
- `package.json` — add `web-push` + `@types/web-push`.

---

## Task 1: PWA shell — manifest, icons, service worker, registration, config

Makes Kita installable. No push yet. Independently testable: manifest shape unit test + build + the SW/manifest are reachable without auth redirect.

**Files:**
- Create: `src/app/manifest.ts`, `public/sw.js`, `public/icons/*` (copied), `src/components/pwa/ServiceWorkerRegistrar.tsx`, `src/app/manifest.test.ts`
- Modify: `src/middleware.ts`, `next.config.ts`, `src/app/layout.tsx`

**Interfaces:**
- Produces: `/manifest.webmanifest` (from `app/manifest.ts`), `/sw.js` (static, publicly fetchable), `<ServiceWorkerRegistrar />` mounted in root layout.

- [ ] **Step 1: Copy the PWA icons into `public/icons/`**

```bash
mkdir -p public/icons
cp design_handoff_kita/logo/kita-icon-192.png public/icons/kita-icon-192.png
cp design_handoff_kita/logo/kita-icon-512.png public/icons/kita-icon-512.png
cp design_handoff_kita/logo/kita-icon-maskable-512.png public/icons/kita-icon-maskable-512.png
ls -la public/icons/
```
Expected: three PNGs present.

- [ ] **Step 2: Write the manifest shape test (failing)**

`src/app/manifest.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import manifest from './manifest'

describe('manifest', () => {
  it('is standalone, named Kita, terracotta theme, with 192/512/maskable icons', () => {
    const m = manifest()
    expect(m.name).toBe('Kita')
    expect(m.short_name).toBe('Kita')
    expect(m.display).toBe('standalone')
    expect(m.start_url).toBe('/')
    expect(m.theme_color).toBe('#c4623d')
    const sizes = (m.icons ?? []).map((i) => i.sizes)
    expect(sizes).toContain('192x192')
    expect(sizes).toContain('512x512')
    const maskable = (m.icons ?? []).find((i) => i.purpose === 'maskable')
    expect(maskable?.src).toContain('maskable')
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/app/manifest.test.ts`
Expected: FAIL — cannot find `./manifest`.

- [ ] **Step 4: Create `src/app/manifest.ts`**

Theme `#c4623d` ≈ terracotta `oklch(0.63 0.14 40)`; background `#faf6f0` ≈ cream paper.
```ts
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Kita',
    short_name: 'Kita',
    description: 'Family finances for CH & JC',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#faf6f0',
    theme_color: '#c4623d',
    icons: [
      { src: '/icons/kita-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/kita-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/kita-icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/app/manifest.test.ts`
Expected: PASS.

- [ ] **Step 6: Create the service worker `public/sw.js`**

Hand-written (no Workbox). Handles push + notification click; caches nothing aggressively (a no-op fetch handler keeps it a valid installable SW without breaking Server Actions / dynamic data).
```js
// Kita service worker — push notifications + installability.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', function (event) {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch (e) { data = {} }
  const title = data.title || 'Kita'
  const options = {
    body: data.body || '',
    icon: '/icons/kita-icon-192.png',
    badge: '/icons/kita-icon-192.png',
    data: { url: data.url || '/' },
    vibrate: [80, 40, 80],
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ('focus' in c) return c.focus() }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    }),
  )
})
```

- [ ] **Step 7: Create the SW registrar client component**

`src/components/pwa/ServiceWorkerRegistrar.tsx`:
```tsx
'use client'
import { useEffect } from 'react'

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {})
    }
  }, [])
  return null
}
```

- [ ] **Step 8: Widen the middleware matcher for PWA assets**

In `src/middleware.ts`, replace the `config.matcher` line so `sw.js` and `manifest.webmanifest` are NOT intercepted (they must be publicly fetchable — the SW registers pre-auth):
```ts
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|sw.js|manifest.webmanifest|.*\\.png$).*)'],
}
```

- [ ] **Step 9: Add SW headers + baseline security headers to `next.config.ts`**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
```
Note: do NOT set `X-Frame-Options: DENY` globally without checking — it's fine here (no legitimate iframing). Keep it out to avoid surprising the design demo; the two headers above are enough.

- [ ] **Step 10: Wire Apple web-app meta + SW registrar into the root layout**

In `src/app/layout.tsx`: add Apple PWA meta to `metadata`, and mount `<ServiceWorkerRegistrar />` inside `<body>`. Next auto-injects the manifest `<link>` from `manifest.ts`, so do not hand-add it.
```tsx
export const metadata: Metadata = {
  title: "Kita",
  description: "Kita family finance tracker",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Kita" },
};
```
```tsx
// inside <body ...>
<ServiceWorkerRegistrar />
{children}
```
Add the import: `import { ServiceWorkerRegistrar } from "@/components/pwa/ServiceWorkerRegistrar";`

- [ ] **Step 11: Verify build + tests + lint**

Run: `npx vitest run src/app/manifest.test.ts && npx tsc --noEmit && npm run build`
Expected: test PASS, tsc clean, build succeeds (route list shows `/manifest.webmanifest`).

- [ ] **Step 12: Commit**

```bash
git add public/icons src/app/manifest.ts src/app/manifest.test.ts public/sw.js \
  src/components/pwa/ServiceWorkerRegistrar.tsx src/middleware.ts next.config.ts src/app/layout.tsx
git commit -m "feat: PWA shell — manifest, icons, service worker, registration"
```

---

## Task 2: Service-role client + Settings data layer + i18n keys + dead-key cleanup

Server-side data for the Settings screen, the admin client both invite and cron need, and all the copy. Independently testable: locale-parity test + pure `settings-shared` unit test.

**Files:**
- Create: `src/lib/supabase/admin.ts`, `src/lib/data/settings-shared.ts`, `src/lib/data/settings.ts`, `src/lib/data/settings-shared.test.ts`
- Modify: `src/i18n/dictionaries.ts`

**Interfaces:**
- Produces:
  - `createAdminClient(): SupabaseClient` (server-only, service-role).
  - `type MemberRow = { code: 'CH' | 'JC'; displayName: string; role: 'owner' | 'member' }`
  - `type SettingsData = { members: MemberRow[]; language: 'en' | 'zh'; reminders: { monthly: boolean; yearly: boolean }; pushSubscribed: boolean }`
  - `isValidEmail(v: string): boolean`
  - `getSettingsData(): Promise<SettingsData | null>`

- [ ] **Step 1: Write the failing `settings-shared` test**

`src/lib/data/settings-shared.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { isValidEmail } from './settings-shared'

describe('isValidEmail', () => {
  it('accepts a normal address', () => {
    expect(isValidEmail('jc@example.com')).toBe(true)
  })
  it('rejects blanks and malformed', () => {
    expect(isValidEmail('')).toBe(false)
    expect(isValidEmail('nope')).toBe(false)
    expect(isValidEmail('a@b')).toBe(false)
    expect(isValidEmail('a b@c.com')).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/data/settings-shared.test.ts`
Expected: FAIL — cannot find `./settings-shared`.

- [ ] **Step 3: Create `src/lib/data/settings-shared.ts` (pure, client-safe)**

```ts
export type MemberCode = 'CH' | 'JC'
export type MemberRow = { code: MemberCode; displayName: string; role: 'owner' | 'member' }
export type SettingsData = {
  members: MemberRow[]
  language: 'en' | 'zh'
  reminders: { monthly: boolean; yearly: boolean }
  pushSubscribed: boolean
}

// Pragmatic email check — one @, a dot in the domain, no spaces.
export function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/data/settings-shared.test.ts`
Expected: PASS.

- [ ] **Step 5: Create the service-role admin client `src/lib/supabase/admin.ts`**

Server-only; no cookies, no session; used ONLY where RLS must be bypassed. `createClient` from `@supabase/supabase-js` (already a transitive dep of `@supabase/ssr`; if the import fails, add `@supabase/supabase-js` to package.json).
```ts
import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export function createAdminClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}
```
If `server-only` is not installed, either `npm i server-only` or drop the import (the service-role key usage is already confined to server modules). Prefer installing `server-only` — it hard-fails the build if a client component imports this.

- [ ] **Step 6: Create the Settings data layer `src/lib/data/settings.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import { getMembership } from './household'
import type { SettingsData, MemberRow } from './settings-shared'

export async function getSettingsData(): Promise<SettingsData | null> {
  const m = await getMembership()
  if (!m) return null
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: memberRows } = await supabase
    .from('household_members')
    .select('member_code, role, profiles!inner(display_name)')
    .eq('household_id', m.householdId)

  const members: MemberRow[] = (memberRows ?? []).map((r) => {
    const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
    return {
      code: r.member_code as MemberRow['code'],
      displayName: p?.display_name ?? r.member_code,
      role: r.role as MemberRow['role'],
    }
  }).sort((a, b) => (a.role === 'owner' ? -1 : 1))

  const { data: rem } = await supabase
    .from('reminder_settings')
    .select('reminder_type, enabled')
    .eq('user_id', user.id)
  const remMap = new Map((rem ?? []).map((r) => [r.reminder_type, r.enabled]))

  const { count: subCount } = await supabase
    .from('push_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  return {
    members,
    language: m.language,
    reminders: {
      monthly: remMap.get('monthly_commitment') ?? true, // default ON
      yearly: remMap.get('yearly_big_payment') ?? true,   // default ON
    },
    pushSubscribed: (subCount ?? 0) > 0,
  }
}
```

- [ ] **Step 7: Add `settings.*` / `push.*` i18n keys and remove dead `asset.status.*` keys**

In `src/i18n/dictionaries.ts`, DELETE these 6 dead keys (confirmed unused — `StatusChip` uses `status.*`): `asset.status.paid`, `asset.status.upcoming`, `asset.status.closed` in BOTH the `en` block (lines ~96–98) and the `zh` block (lines ~212–214). Keep `asset.of`.

Then ADD to the `en` block:
```ts
    'settings.members': 'Household members',
    'settings.you': 'You',
    'settings.admin': 'Admin',
    'settings.partner': 'Partner',
    'settings.invitePlaceholder': 'Invite by email',
    'settings.invite': 'Invite',
    'settings.inviteAdded': 'Added to your household',
    'settings.language': 'Language',
    'settings.notifications': 'Notifications',
    'settings.notif.monthly': 'Monthly commitments',
    'settings.notif.monthlyDesc': 'House · utilities · internet',
    'settings.notif.yearly': 'Yearly big payments',
    'settings.notif.yearlyDesc': 'AIA · road tax & insurance',
    'settings.notif.push': 'Push notifications',
    'settings.notif.pushDesc': 'Requires Home Screen install on iPhone',
    'settings.install.title': 'Add Kita to Home Screen',
    'settings.install.desc': 'Install to get reminders & push on iOS',
    'settings.install.button': 'Install',
    'settings.install.iosHint': 'Tap the Share button, then “Add to Home Screen”.',
    'settings.installed': 'Installed',
    'settings.signOut': 'Sign out',
    'push.test': 'Send a test notification',
    'push.notSupported': 'Push isn’t supported on this device',
    'push.demoTitle': 'Reminders',
    'push.monthly.title': 'Monthly commitments due',
    'push.monthly.body': 'Time to log this month’s commitments in Kita.',
    'push.yearly.title': 'Big payment coming up',
    'push.yearly.body': 'A yearly payment is due soon.',
    'error.invalid_email': 'Enter a valid email',
    'error.invite_not_found': 'No Kita account with that email',
    'error.invite_already_member': 'Already in your household',
    'error.invite_failed': 'Couldn’t add — please try again',
    'error.push_failed': 'Couldn’t update push — please try again',
```
And the matching `zh` block:
```ts
    'settings.members': '家庭成员',
    'settings.you': '你',
    'settings.admin': '管理员',
    'settings.partner': '伴侣',
    'settings.invitePlaceholder': '通过邮箱邀请',
    'settings.invite': '邀请',
    'settings.inviteAdded': '已加入你的家庭',
    'settings.language': '语言',
    'settings.notifications': '通知',
    'settings.notif.monthly': '每月固定支出',
    'settings.notif.monthlyDesc': '房贷 · 水电 · 网络',
    'settings.notif.yearly': '年度大额付款',
    'settings.notif.yearlyDesc': 'AIA · 路税与保险',
    'settings.notif.push': '推送通知',
    'settings.notif.pushDesc': 'iPhone 需先添加到主屏幕',
    'settings.install.title': '将 Kita 添加到主屏幕',
    'settings.install.desc': '安装后即可在 iOS 接收提醒与推送',
    'settings.install.button': '安装',
    'settings.install.iosHint': '点击分享按钮，然后选择“添加到主屏幕”。',
    'settings.installed': '已安装',
    'settings.signOut': '退出登录',
    'push.test': '发送测试通知',
    'push.notSupported': '此设备不支持推送',
    'push.demoTitle': '提醒',
    'push.monthly.title': '每月固定支出到期',
    'push.monthly.body': '该在 Kita 记录本月固定支出了。',
    'push.yearly.title': '即将有大额付款',
    'push.yearly.body': '一笔年度付款即将到期。',
    'error.invalid_email': '请输入有效邮箱',
    'error.invite_not_found': '找不到该邮箱的 Kita 账户',
    'error.invite_already_member': '已在你的家庭中',
    'error.invite_failed': '添加失败，请重试',
    'error.push_failed': '推送更新失败，请重试',
```

- [ ] **Step 8: Run locale-parity + shared test**

Run: `npx vitest run src/i18n/dictionaries.test.ts src/lib/data/settings-shared.test.ts && npx tsc --noEmit`
Expected: PASS, tsc clean.

- [ ] **Step 9: Commit**

```bash
git add src/lib/supabase/admin.ts src/lib/data/settings-shared.ts src/lib/data/settings.ts \
  src/lib/data/settings-shared.test.ts src/i18n/dictionaries.ts package.json package-lock.json
git commit -m "feat: settings data layer + service-role client + i18n keys (drop dead asset.status.*)"
```

---

## Task 3: Settings screen 3G — view + language/reminder/signout/invite actions

The visible Settings screen and its non-push actions. Push toggle is stubbed here (disabled placeholder) and wired in Task 4. Independently testable: renders in build; invite-email validation is covered by Task 2's `isValidEmail` test.

**Files:**
- Create: `src/app/(app)/settings/page.tsx`, `src/app/(app)/settings/SettingsView.tsx`, `src/app/(app)/settings/actions.ts`

**Interfaces:**
- Consumes: `getSettingsData()`, `SettingsData` (Task 2); `createClient` (server), `createAdminClient` (Task 2); `useT` / `useLocale`.
- Produces server actions:
  - `updateLanguage(lang: 'en' | 'zh'): Promise<{ ok: boolean; error?: string }>`
  - `updateReminderSetting(type: 'monthly_commitment' | 'yearly_big_payment', enabled: boolean): Promise<{ ok: boolean; error?: string }>`
  - `inviteMember(email: string): Promise<{ ok: boolean; error?: string }>`
  - `signOutAction(): Promise<void>` (redirects to `/login`)

- [ ] **Step 1: Create the actions `src/app/(app)/settings/actions.ts`**

```ts
'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMembership } from '@/lib/data/household'
import { isValidEmail } from '@/lib/data/settings-shared'

export async function updateLanguage(lang: 'en' | 'zh'): Promise<{ ok: boolean; error?: string }> {
  if (lang !== 'en' && lang !== 'zh') return { ok: false, error: 'save_failed' }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'not_authenticated' }
  const { error } = await supabase.from('profiles').update({ language: lang }).eq('id', user.id)
  if (error) { console.error('updateLanguage:', error.message); return { ok: false, error: 'save_failed' } }
  revalidatePath('/', 'layout') // re-seed LocaleProvider app-wide
  return { ok: true }
}

export async function updateReminderSetting(
  type: 'monthly_commitment' | 'yearly_big_payment',
  enabled: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'not_authenticated' }
  const { error } = await supabase
    .from('reminder_settings')
    .upsert({ user_id: user.id, reminder_type: type, enabled }, { onConflict: 'user_id,reminder_type' })
  if (error) { console.error('updateReminderSetting:', error.message); return { ok: false, error: 'save_failed' } }
  return { ok: true }
}

// Lightweight invite: add an EXISTING Kita account (profile) to this household.
// No new tables, no email delivery. Service-role bypasses the SELECT-only RLS
// on household_members. Assigns the JC member slot if free.
export async function inviteMember(email: string): Promise<{ ok: boolean; error?: string }> {
  const clean = email.trim().toLowerCase()
  if (!isValidEmail(clean)) return { ok: false, error: 'invalid_email' }
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('id').eq('email', clean).maybeSingle()
  if (!profile) return { ok: false, error: 'invite_not_found' }

  const { data: existing } = await admin
    .from('household_members').select('household_id, member_code').eq('user_id', profile.id).maybeSingle()
  if (existing?.household_id === m.householdId) return { ok: false, error: 'invite_already_member' }
  if (existing) return { ok: false, error: 'invite_already_member' } // already in another household

  const { data: taken } = await admin
    .from('household_members').select('member_code').eq('household_id', m.householdId)
  const used = new Set((taken ?? []).map((r) => r.member_code))
  const slot = ['JC', 'CH'].find((c) => !used.has(c))
  if (!slot) return { ok: false, error: 'invite_failed' } // household full (2 members)

  const { error } = await admin.from('household_members').insert({
    household_id: m.householdId, user_id: profile.id, role: 'member', member_code: slot,
  })
  if (error) { console.error('inviteMember:', error.message); return { ok: false, error: 'invite_failed' } }
  revalidatePath('/settings')
  return { ok: true }
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
```

- [ ] **Step 2: Create the Settings server component `src/app/(app)/settings/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { getSettingsData } from '@/lib/data/settings'
import { SettingsView } from './SettingsView'

export default async function SettingsPage() {
  const data = await getSettingsData()
  if (!data) redirect('/login')
  return <SettingsView data={data} />
}
```

- [ ] **Step 3: Create `src/app/(app)/settings/SettingsView.tsx` (client, full-screen — no tab bar)**

Full-screen overlay pattern (like `AddAssetForm`) so the bottom tab bar is hidden. Back header + `Settings`. Members list, invite input, language EN/中文 toggle, three notification `Switch` rows (push row disabled+stubbed until Task 4), install card, sign-out. Use `useTransition` for action calls; `router.refresh()` after language change.
```tsx
'use client'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { useT, useLocale } from '@/i18n/LocaleProvider'
import { MemberAvatar } from '@/components/ui/MemberAvatar'
import type { SettingsData } from '@/lib/data/settings-shared'
import { updateLanguage, updateReminderSetting, inviteMember, signOutAction } from './actions'

export function SettingsView({ data }: { data: SettingsData }) {
  const t = useT()
  const locale = useLocale()
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [monthly, setMonthly] = useState(data.reminders.monthly)
  const [yearly, setYearly] = useState(data.reminders.yearly)
  const [email, setEmail] = useState('')
  const [inviteMsg, setInviteMsg] = useState<{ ok: boolean; key: string } | null>(null)

  function onLanguage(lang: 'en' | 'zh') {
    if (lang === locale) return
    startTransition(async () => {
      await updateLanguage(lang)
      router.refresh()
    })
  }
  function onMonthly(next: boolean) {
    setMonthly(next)
    startTransition(() => { updateReminderSetting('monthly_commitment', next) })
  }
  function onYearly(next: boolean) {
    setYearly(next)
    startTransition(() => { updateReminderSetting('yearly_big_payment', next) })
  }
  async function onInvite() {
    const res = await inviteMember(email)
    if (res.ok) { setInviteMsg({ ok: true, key: 'settings.inviteAdded' }); setEmail(''); router.refresh() }
    else setInviteMsg({ ok: false, key: `error.${res.error}` })
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[var(--paper)]">
      <div className="mx-auto flex min-h-full max-w-[430px] flex-col px-[18px] pb-10 pt-4">
        {/* header */}
        <div className="flex items-center gap-1 py-2">
          <Link href="/" aria-label={t('common.back')} className="grid h-11 w-11 place-items-center -ml-2 text-[var(--muted)]">
            <ChevronLeft size={24} />
          </Link>
          <h1 className="text-lg font-extrabold text-[var(--ink-head)]">{t('settings.title')}</h1>
        </div>

        {/* Members */}
        <Section title={t('settings.members')}>
          <div className="flex flex-col gap-3">
            {data.members.map((mem) => (
              <div key={mem.code} className="flex items-center gap-3">
                <MemberAvatar member={mem.code} size={36} />
                <div className="flex-1">
                  <p className="text-sm font-bold text-[var(--ink)]">{mem.displayName}</p>
                  <p className="text-xs font-semibold text-[var(--muted)]">
                    {mem.role === 'owner' ? `${t('settings.you')} · ${t('settings.admin')}` : t('settings.partner')}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              type="email" value={email} onChange={(e) => { setEmail(e.target.value); setInviteMsg(null) }}
              placeholder={t('settings.invitePlaceholder')}
              className="flex-1 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-2.5 text-sm outline-none placeholder:text-[var(--faint)]"
            />
            <button onClick={onInvite} disabled={!email.trim()}
              className="rounded-xl bg-[var(--primary-btn)] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">
              {t('settings.invite')}
            </button>
          </div>
          {inviteMsg && (
            <p className={`mt-2 text-xs font-semibold ${inviteMsg.ok ? 'text-[var(--positive-text)]' : 'text-[var(--danger)]'}`}>
              {t(inviteMsg.key)}
            </p>
          )}
        </Section>

        {/* Language */}
        <Section title={t('settings.language')}>
          <div className="flex gap-2">
            {(['en', 'zh'] as const).map((lang) => {
              const active = locale === lang
              return (
                <button key={lang} onClick={() => onLanguage(lang)}
                  className="flex-1 rounded-xl border py-2.5 text-sm font-bold"
                  style={{
                    borderColor: active ? 'var(--primary)' : 'var(--hairline)',
                    background: active ? 'var(--primary)' : 'var(--surface)',
                    color: active ? 'white' : 'var(--ink)',
                  }}>
                  {lang === 'en' ? 'English' : '中文'}
                </button>
              )
            })}
          </div>
        </Section>

        {/* Notifications */}
        <Section title={t('settings.notifications')}>
          <SwitchRow label={t('settings.notif.monthly')} desc={t('settings.notif.monthlyDesc')} checked={monthly} onChange={onMonthly} />
          <SwitchRow label={t('settings.notif.yearly')} desc={t('settings.notif.yearlyDesc')} checked={yearly} onChange={onYearly} />
          {/* push row is added in Task 4 */}
        </Section>

        <div className="flex-1" />

        <button onClick={() => startTransition(() => { signOutAction() })}
          className="mt-6 w-full rounded-xl border border-[var(--danger)] py-3 text-sm font-bold text-[var(--danger)]">
          {t('settings.signOut')}
        </button>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{title}</h2>
      <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-4">{children}</div>
    </section>
  )
}

export function SwitchRow({
  label, desc, checked, onChange, disabled,
}: { label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
      <div>
        <p className="text-sm font-bold text-[var(--ink)]">{label}</p>
        {desc && <p className="text-xs font-semibold text-[var(--muted)]">{desc}</p>}
      </div>
      <button
        role="switch" aria-checked={checked} aria-label={label} disabled={disabled}
        onClick={() => onChange(!checked)}
        className="relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-40"
        style={{ background: checked ? 'var(--primary)' : 'var(--hairline)' }}>
        <span className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all"
          style={{ left: checked ? '22px' : '2px' }} />
      </button>
    </div>
  )
}
```
Note: verify `--danger`, `--positive-text`, `--surface`, `--hairline`, `--faint`, `--primary-btn`, `--subtle` exist in `globals.css`; if a token is missing, use the nearest existing one (the reviewer will check against the design tokens).

- [ ] **Step 4: Verify build + tsc**

Run: `npx tsc --noEmit && npm run build`
Expected: tsc clean, build succeeds; `/settings` appears in the route list.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/settings"
git commit -m "feat: Settings screen 3G — members/invite/language/reminders/sign out"
```

---

## Task 4: Web Push — subscribe/unsubscribe/test + install prompt

Turns the push toggle live and adds the install card. Independently testable: pure `push-shared` unit tests; build.

**Files:**
- Create: `src/lib/push/push-shared.ts`, `src/lib/push/web-push.ts`, `src/lib/push/push-shared.test.ts`
- Modify: `src/app/(app)/settings/actions.ts` (add push actions), `src/app/(app)/settings/SettingsView.tsx` (push row + install card), `.env.example`, `package.json`

**Interfaces:**
- Consumes: `createClient` (server), `createAdminClient`, `web-push`.
- Produces:
  - `urlBase64ToUint8Array(base64: string): Uint8Array` (pure)
  - `serializeSubscription(sub: PushSubscription): { endpoint: string; p256dh: string; auth: string }` (pure)
  - `sendPushToUser(userId: string, payload: { title: string; body: string; url?: string }): Promise<number>` (server; returns count sent)
  - actions `subscribeToPush(sub)`, `unsubscribeFromPush(endpoint)`, `sendTestPush()`

- [ ] **Step 1: Add `web-push` dependency**

```bash
npm install web-push
npm install -D @types/web-push
```

- [ ] **Step 2: Write failing `push-shared` tests**

`src/lib/push/push-shared.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { urlBase64ToUint8Array } from './push-shared'

describe('urlBase64ToUint8Array', () => {
  it('decodes a url-safe base64 VAPID key to bytes', () => {
    const out = urlBase64ToUint8Array('BParzo') // arbitrary url-safe sample
    expect(out).toBeInstanceOf(Uint8Array)
    expect(out.length).toBeGreaterThan(0)
  })
  it('handles padding and url-safe chars (- _) without throwing', () => {
    expect(() => urlBase64ToUint8Array('a-b_c')).not.toThrow()
  })
})
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run src/lib/push/push-shared.test.ts`
Expected: FAIL — cannot find `./push-shared`.

- [ ] **Step 4: Create `src/lib/push/push-shared.ts` (pure, client-safe)**

```ts
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = typeof atob === 'function' ? atob(base64) : Buffer.from(base64, 'base64').toString('binary')
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export type SerializedSubscription = { endpoint: string; p256dh: string; auth: string }

export function serializeSubscription(sub: PushSubscription): SerializedSubscription {
  const json = sub.toJSON()
  return {
    endpoint: sub.endpoint,
    p256dh: json.keys?.p256dh ?? '',
    auth: json.keys?.auth ?? '',
  }
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run src/lib/push/push-shared.test.ts`
Expected: PASS.

- [ ] **Step 6: Create `src/lib/push/web-push.ts` (server-only)**

```ts
import 'server-only'
import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'

let configured = false
function configure() {
  if (configured) return
  webpush.setVapidDetails(
    'mailto:cch340@gmail.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  )
  configured = true
}

export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string },
): Promise<number> {
  configure()
  const admin = createAdminClient()
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId)
  let sent = 0
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
      )
      sent++
    } catch (err: unknown) {
      const status = (err as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) {
        await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint) // prune dead
      } else {
        console.error('sendPushToUser:', (err as Error).message)
      }
    }
  }
  return sent
}
```

- [ ] **Step 7: Add push actions to `src/app/(app)/settings/actions.ts`**

Append (keep the existing imports; add `serializeSubscription`, `sendPushToUser`, and the localized-copy imports):
```ts
import { serializeSubscription, type SerializedSubscription } from '@/lib/push/push-shared'
import { sendPushToUser } from '@/lib/push/web-push'
import { t } from '@/i18n'
// ...

export async function subscribeToPush(sub: SerializedSubscription): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'not_authenticated' }
  const { error } = await supabase.from('push_subscriptions').upsert(
    { user_id: user.id, endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
    { onConflict: 'endpoint' },
  )
  if (error) { console.error('subscribeToPush:', error.message); return { ok: false, error: 'push_failed' } }
  revalidatePath('/settings')
  return { ok: true }
}

export async function unsubscribeFromPush(endpoint: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'not_authenticated' }
  const { error } = await supabase.from('push_subscriptions').delete().eq('user_id', user.id).eq('endpoint', endpoint)
  if (error) { console.error('unsubscribeFromPush:', error.message); return { ok: false, error: 'push_failed' } }
  revalidatePath('/settings')
  return { ok: true }
}

export async function sendTestPush(): Promise<{ ok: boolean; error?: string }> {
  const m = await getMembership()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !m) return { ok: false, error: 'not_authenticated' }
  const n = await sendPushToUser(user.id, {
    title: t(m.language, 'push.demoTitle'),
    body: t(m.language, 'push.monthly.body'),
    url: '/',
  })
  return n > 0 ? { ok: true } : { ok: false, error: 'push_failed' }
}
```
Note: `serializeSubscription` is imported for its TYPE only here; the client calls it. Keep `SerializedSubscription` as the action's param type. If the unused-value import trips lint, import the type with `import type { SerializedSubscription }` and drop `serializeSubscription` from this file.

- [ ] **Step 8: Add the push row + install card to `SettingsView.tsx`**

Add client state + handlers. Detect support/standalone/iOS; subscribe via `navigator.serviceWorker.ready` + `pushManager.subscribe` using `NEXT_PUBLIC_VAPID_PUBLIC_KEY`; persist via `subscribeToPush(serializeSubscription(sub))`. Add the push `SwitchRow` (below the yearly row) and the Install `Section`/card. Imports to add: `useEffect`, `urlBase64ToUint8Array`, `serializeSubscription`, `subscribeToPush`, `unsubscribeFromPush`.
```tsx
// state
const [pushOn, setPushOn] = useState(data.pushSubscribed)
const [supported, setSupported] = useState(false)
const [isIOS, setIsIOS] = useState(false)
const [standalone, setStandalone] = useState(false)

useEffect(() => {
  setSupported('serviceWorker' in navigator && 'PushManager' in window)
  setIsIOS(/ipad|iphone|ipod/i.test(navigator.userAgent))
  setStandalone(window.matchMedia('(display-mode: standalone)').matches
    || (navigator as unknown as { standalone?: boolean }).standalone === true)
}, [])

async function onPush(next: boolean) {
  if (!supported) return
  try {
    const reg = await navigator.serviceWorker.ready
    if (next) {
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      })
      const res = await subscribeToPush(serializeSubscription(sub))
      setPushOn(res.ok)
    } else {
      const sub = await reg.pushManager.getSubscription()
      if (sub) { await unsubscribeFromPush(sub.endpoint); await sub.unsubscribe() }
      setPushOn(false)
    }
  } catch { setPushOn(false) }
}
```
```tsx
{/* push row — inside the Notifications Section, after yearly */}
<SwitchRow
  label={t('settings.notif.push')}
  desc={supported ? t('settings.notif.pushDesc') : t('push.notSupported')}
  checked={pushOn}
  onChange={onPush}
  disabled={!supported}
/>

{/* Install card — only when not already installed */}
{!standalone && (
  <section className="mt-5">
    <div className="rounded-2xl bg-[var(--hero-grad,var(--primary))] p-4 text-white"
      style={{ background: 'linear-gradient(135deg, var(--primary), oklch(0.58 0.14 35))' }}>
      <p className="text-sm font-extrabold">{t('settings.install.title')}</p>
      <p className="mt-1 text-xs font-semibold opacity-90">{t('settings.install.desc')}</p>
      {isIOS
        ? <p className="mt-3 text-xs font-semibold opacity-90">{t('settings.install.iosHint')}</p>
        : <button disabled className="mt-3 rounded-lg bg-white/20 px-4 py-2 text-sm font-bold">
            {t('settings.install.button')}
          </button>}
    </div>
  </section>
)}
```
Note: Android/Chrome `beforeinstallprompt` is intentionally not wired (per the Next.js PWA guide's recommendation against it — not cross-platform). The Install button is a visual affordance; iOS shows the Share-sheet hint, which is the real install path on iPhone.

- [ ] **Step 9: Add VAPID + cron env to `.env.example`**

```
# Web Push (generate with: npx web-push generate-vapid-keys)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
# Protects the reminder cron route (Phase 6 / Vercel Cron)
CRON_SECRET=
```

- [ ] **Step 10: Verify tests + build**

Run: `npx vitest run src/lib/push/push-shared.test.ts && npx tsc --noEmit && npm run build`
Expected: PASS, tsc clean, build succeeds.

- [ ] **Step 11: Commit**

```bash
git add src/lib/push "src/app/(app)/settings" .env.example package.json package-lock.json
git commit -m "feat: Web Push — subscribe/unsubscribe/test + install card"
```

---

## Task 5: Reminder scan (pure core + cron route) + 3H push demo

The server logic that decides which reminders are due and sends them, plus the static 3H screen. Independently testable: `dueReminders` unit tests cover the decision logic.

**Files:**
- Create: `src/lib/data/reminders-shared.ts`, `src/lib/data/reminders.ts`, `src/lib/data/reminders-shared.test.ts`, `src/app/api/reminders/run/route.ts`, `src/app/(app)/push-demo/page.tsx`
- Modify: `SETUP.md`

**Interfaces:**
- Consumes: `createAdminClient`, `sendPushToUser`, `t` (server i18n).
- Produces:
  - `type ReminderRecipient = { userId: string; language: 'en' | 'zh'; monthly: boolean; yearly: boolean }`
  - `type BigPayment = { dateISO: string }`
  - `dueReminders(todayISO: string, ctx: { hasMonthlyCommitments: boolean; bigPayments: BigPayment[]; recipients: ReminderRecipient[] }): Array<{ userId: string; kind: 'monthly' | 'yearly' }>`
  - `runReminderScan(todayISO: string): Promise<{ sent: number }>`

- [ ] **Step 1: Write failing `dueReminders` tests**

Rules to encode: **monthly** fires on the 1st of the month for recipients with monthly enabled AND the household has monthly commitments. **yearly** fires when a big payment's date is within the next 7 days (inclusive) for recipients with yearly enabled. Disabled recipients get nothing.

`src/lib/data/reminders-shared.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { dueReminders } from './reminders-shared'

const rec = (o: Partial<{ userId: string; monthly: boolean; yearly: boolean }> = {}) => ({
  userId: o.userId ?? 'u1', language: 'en' as const,
  monthly: o.monthly ?? true, yearly: o.yearly ?? true,
})

describe('dueReminders', () => {
  it('fires monthly on the 1st when commitments exist and enabled', () => {
    const out = dueReminders('2026-08-01', { hasMonthlyCommitments: true, bigPayments: [], recipients: [rec()] })
    expect(out).toContainEqual({ userId: 'u1', kind: 'monthly' })
  })
  it('does not fire monthly on a non-first day', () => {
    const out = dueReminders('2026-08-15', { hasMonthlyCommitments: true, bigPayments: [], recipients: [rec()] })
    expect(out.find((r) => r.kind === 'monthly')).toBeUndefined()
  })
  it('skips monthly when the recipient disabled it', () => {
    const out = dueReminders('2026-08-01', { hasMonthlyCommitments: true, bigPayments: [], recipients: [rec({ monthly: false })] })
    expect(out.length).toBe(0)
  })
  it('skips monthly when there are no commitments', () => {
    const out = dueReminders('2026-08-01', { hasMonthlyCommitments: false, bigPayments: [], recipients: [rec()] })
    expect(out.find((r) => r.kind === 'monthly')).toBeUndefined()
  })
  it('fires yearly when a big payment is within 7 days', () => {
    const out = dueReminders('2026-09-01', { hasMonthlyCommitments: false, bigPayments: [{ dateISO: '2026-09-05' }], recipients: [rec()] })
    expect(out).toContainEqual({ userId: 'u1', kind: 'yearly' })
  })
  it('does not fire yearly for a payment far away', () => {
    const out = dueReminders('2026-09-01', { hasMonthlyCommitments: false, bigPayments: [{ dateISO: '2026-12-01' }], recipients: [rec()] })
    expect(out.find((r) => r.kind === 'yearly')).toBeUndefined()
  })
  it('skips yearly when the recipient disabled it', () => {
    const out = dueReminders('2026-09-01', { hasMonthlyCommitments: false, bigPayments: [{ dateISO: '2026-09-05' }], recipients: [rec({ yearly: false })] })
    expect(out.length).toBe(0)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/data/reminders-shared.test.ts`
Expected: FAIL — cannot find `./reminders-shared`.

- [ ] **Step 3: Create `src/lib/data/reminders-shared.ts` (pure)**

```ts
export type ReminderRecipient = { userId: string; language: 'en' | 'zh'; monthly: boolean; yearly: boolean }
export type BigPayment = { dateISO: string }
export type DueReminder = { userId: string; kind: 'monthly' | 'yearly' }

const DAY = 86_400_000
const YEARLY_WINDOW_DAYS = 7

export function dueReminders(
  todayISO: string,
  ctx: { hasMonthlyCommitments: boolean; bigPayments: BigPayment[]; recipients: ReminderRecipient[] },
): DueReminder[] {
  const today = new Date(todayISO + 'T00:00:00Z')
  const isFirstOfMonth = today.getUTCDate() === 1
  const yearlyDue = ctx.bigPayments.some((p) => {
    const d = new Date(p.dateISO + 'T00:00:00Z')
    const diffDays = Math.round((d.getTime() - today.getTime()) / DAY)
    return diffDays >= 0 && diffDays <= YEARLY_WINDOW_DAYS
  })
  const out: DueReminder[] = []
  for (const r of ctx.recipients) {
    if (r.monthly && ctx.hasMonthlyCommitments && isFirstOfMonth) out.push({ userId: r.userId, kind: 'monthly' })
    if (r.yearly && yearlyDue) out.push({ userId: r.userId, kind: 'yearly' })
  }
  return out
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/data/reminders-shared.test.ts`
Expected: all PASS.

- [ ] **Step 5: Create the server scan `src/lib/data/reminders.ts`**

Gathers cross-user data via the admin client (cron has no session), computes due reminders, sends push with each recipient's localized copy. Big payments = upcoming, unsettled `asset_transactions` of the yearly kinds.
```ts
import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToUser } from '@/lib/push/web-push'
import { t } from '@/i18n'
import { dueReminders, type ReminderRecipient, type BigPayment } from './reminders-shared'

export async function runReminderScan(todayISO: string): Promise<{ sent: number }> {
  const admin = createAdminClient()

  // recipients: every profile + its reminder settings (default ON when no row)
  const { data: profiles } = await admin.from('profiles').select('id, language')
  const { data: settings } = await admin.from('reminder_settings').select('user_id, reminder_type, enabled')
  const enabledMap = new Map<string, boolean>()
  for (const s of settings ?? []) enabledMap.set(`${s.user_id}:${s.reminder_type}`, s.enabled)
  const recipients: ReminderRecipient[] = (profiles ?? []).map((p) => ({
    userId: p.id,
    language: (p.language ?? 'en') as 'en' | 'zh',
    monthly: enabledMap.get(`${p.id}:monthly_commitment`) ?? true,
    yearly: enabledMap.get(`${p.id}:yearly_big_payment`) ?? true,
  }))

  const { count: commitCount } = await admin
    .from('monthly_commitments').select('id', { count: 'exact', head: true })
  const hasMonthlyCommitments = (commitCount ?? 0) > 0

  const horizon = new Date(new Date(todayISO + 'T00:00:00Z').getTime() + 8 * 86_400_000)
  const { data: txns } = await admin
    .from('asset_transactions')
    .select('date')
    .eq('settled', false)
    .in('txn_type', ['road_tax_insurance', 'scheduled_payment'])
    .gte('date', todayISO)
    .lte('date', horizon.toISOString().slice(0, 10))
  const bigPayments: BigPayment[] = (txns ?? []).map((r) => ({ dateISO: r.date as string }))

  const due = dueReminders(todayISO, { hasMonthlyCommitments, bigPayments, recipients })
  const langByUser = new Map(recipients.map((r) => [r.userId, r.language]))

  let sent = 0
  for (const d of due) {
    const lang = langByUser.get(d.userId) ?? 'en'
    const payload = d.kind === 'monthly'
      ? { title: t(lang, 'push.monthly.title'), body: t(lang, 'push.monthly.body'), url: '/budget' }
      : { title: t(lang, 'push.yearly.title'), body: t(lang, 'push.yearly.body'), url: '/assets' }
    sent += await sendPushToUser(d.userId, payload)
  }
  return { sent }
}
```

- [ ] **Step 6: Create the protected cron route `src/app/api/reminders/run/route.ts`**

Guarded by `CRON_SECRET` (Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`). Computes "today" server-side.
```ts
import { NextResponse, type NextRequest } from 'next/server'
import { runReminderScan } from '@/lib/data/reminders'

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  const todayISO = new Date().toISOString().slice(0, 10)
  const result = await runReminderScan(todayISO)
  return NextResponse.json({ ok: true, ...result })
}
```

- [ ] **Step 7: Create the 3H push demo `src/app/(app)/push-demo/page.tsx`**

Static lock-screen mock: dark warm gradient, big clock, two frosted Kita notification cards. Not linked from the tab bar; reachable at `/push-demo` for reference. Full-screen container (no tab bar). Use server i18n via `getMembership()` for locale.
```tsx
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getMembership } from '@/lib/data/household'
import { t } from '@/i18n'

export default async function PushDemoPage() {
  const m = await getMembership()
  const locale = m?.language ?? 'en'
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto"
      style={{ background: 'linear-gradient(160deg, #2a1d16, #4a2f22)' }}>
      <div className="mx-auto flex min-h-full max-w-[430px] flex-col px-[18px] pb-10 pt-4 text-white">
        <Link href="/settings" aria-label={t(locale, 'common.back')} className="grid h-11 w-11 place-items-center -ml-2 text-white/70">
          <ChevronLeft size={24} />
        </Link>
        <div className="mt-8 text-center">
          <p className="text-6xl font-extralight tracking-tight">9:41</p>
          <p className="mt-1 text-sm font-semibold text-white/70">Saturday, 4 July</p>
        </div>
        <div className="mt-10 flex flex-col gap-3">
          {[
            { title: t(locale, 'push.monthly.title'), body: t(locale, 'push.monthly.body') },
            { title: t(locale, 'push.yearly.title'), body: t(locale, 'push.yearly.body') },
          ].map((n, i) => (
            <div key={i} className="flex items-start gap-3 rounded-2xl bg-white/15 p-3.5 backdrop-blur-md"
              style={{ boxShadow: '0 6px 18px rgba(0,0,0,.18)' }}>
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--primary)] text-xs font-black">K</div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold tracking-wide">KITA</span>
                  <span className="text-xs text-white/60">now</span>
                </div>
                <p className="text-sm font-bold">{n.title}</p>
                <p className="text-xs text-white/80">{n.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 8: Add the Phase 5 section to `SETUP.md`**

Append a "## Phase 5 — Push & install" section documenting: (1) generate VAPID keys with `npx web-push generate-vapid-keys`, put `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` in `.env.local`; (2) set a `CRON_SECRET`; (3) local push testing needs HTTPS — `next dev --experimental-https`; (4) iOS requires Add-to-Home-Screen before push works; (5) the daily reminder trigger is wired in Phase 6 (Vercel Cron → `GET /api/reminders/run` with `Authorization: Bearer $CRON_SECRET`, suggested schedule `0 1 * * *`).

- [ ] **Step 9: Verify all tests + build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all tests PASS (incl. reminders), tsc clean, build succeeds; `/api/reminders/run` and `/push-demo` in the route list.

- [ ] **Step 10: Commit**

```bash
git add src/lib/data/reminders.ts src/lib/data/reminders-shared.ts src/lib/data/reminders-shared.test.ts \
  src/app/api/reminders/run/route.ts "src/app/(app)/push-demo" SETUP.md
git commit -m "feat: reminder scan (due logic + cron route) + 3H push demo"
```

---

## Task 6: Cleanup carry-over — hoist `parseMoneyInput`

Small refactor of the P4 review carry-over: one shared money parser, replacing three local `toCents` copies. Independently testable: `money.test.ts`.

**Files:**
- Modify: `src/lib/money.ts`, `src/lib/money.test.ts`, `src/app/(app)/assets/new/AddAssetForm.tsx`, and the add-expense + add-ledger forms that define a local `toCents`.

**Interfaces:**
- Produces: `parseMoneyInput(v: string): number` in `src/lib/money.ts` (cents; NaN-safe → 0).

- [ ] **Step 1: Add failing tests to `src/lib/money.test.ts`**

```ts
import { parseMoneyInput } from './money'
// ...
describe('parseMoneyInput', () => {
  it('parses a decimal string to cents', () => {
    expect(parseMoneyInput('42.50')).toBe(4250)
    expect(parseMoneyInput('1000')).toBe(100000)
  })
  it('returns 0 for empty or non-numeric input', () => {
    expect(parseMoneyInput('')).toBe(0)
    expect(parseMoneyInput('abc')).toBe(0)
  })
  it('rounds to the nearest cent', () => {
    expect(parseMoneyInput('1.005')).toBe(101) // 100.5 -> 101
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/money.test.ts`
Expected: FAIL — `parseMoneyInput` not exported.

- [ ] **Step 3: Add `parseMoneyInput` to `src/lib/money.ts`**

```ts
export function parseMoneyInput(v: string): number {
  const n = parseFloat(v || '0')
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/money.test.ts`
Expected: PASS.

- [ ] **Step 5: Replace the local `toCents` in each form**

In `AddAssetForm.tsx` and the add-expense + add-ledger forms: delete the local `toCents` function and import + use `parseMoneyInput`. Find them first: `grep -rn "function toCents" src/app`. Replace each `toCents(` call with `parseMoneyInput(` and add `import { parseMoneyInput } from '@/lib/money'`.

- [ ] **Step 6: Verify full suite + build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all PASS, tsc clean, build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/lib/money.ts src/lib/money.test.ts "src/app/(app)"
git commit -m "refactor: hoist toCents -> shared parseMoneyInput (P4 cleanup)"
```

---

## Notes / carry-over not addressed here

- **Vehicle CLOSED state** (settled is a boolean, no explicit CLOSED) — cosmetic; the detail screens already render a CLOSED badge for settled items. Left as-is; revisit only if the design needs a distinct terminal state.
- **Live cron wiring** (Vercel Cron schedule) is Phase 6 — the route + secret + scan logic ship here and are unit-tested; only the scheduler hookup is deferred.
- **Offline caching** intentionally minimal (push-only SW) — full offline shell (Serwist) needs webpack config and conflicts with Turbopack; out of scope.
