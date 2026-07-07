# Customizable Bottom Navigation — Design

**Date:** 2026-07-07
**Status:** Approved, ready for implementation planning

## Goal

Let each user reorder the bottom navigation and choose which destinations appear
in the bar versus the "More" overflow page. The preference is per-user and synced
across all of that user's devices via Supabase.

## Current state

The bottom bar (`src/components/nav/BottomTabBar.tsx`) has **5 fixed slots**:
Home, Expenses, Fund, Budget, and **More**. "More" is an overflow page
(`src/app/(app)/more/page.tsx`) that links to Assets and Manage. So there are
**6 destinations** but only 5 tab slots. Active-tab detection is currently
hardcoded in `BottomTabBar` (e.g. `/` also matches `/personal`; `/more` also
matches `/assets` and `/manage`).

`getMembership()` (`src/lib/data/household.ts`) already reads the user's profile
(`display_name`, `language`) in the app layout and is `cache()`-wrapped. The app
layout (`src/app/(app)/layout.tsx`) is a server component that renders
`BottomTabBar`.

## Model & rules

Six destinations — **Home, Expenses, Fund, Budget, Assets, Manage** — arranged
into two ordered lists:

- **In bar** — up to **4** items, rendered left-to-right, followed by a **pinned
  "More" tab** (the 5th slot, always present, never movable or hideable). This
  reproduces today's layout as the default.
- **In More** — the remaining items, in order, rendered on the `/more` page.

Constraints:
- 1–4 items in the bar; all remaining destinations in More.
- Because there are 6 destinations and the bar caps at 4, More always has ≥2
  items, so the "More" tab is always present.
- The editor disables "move to bar" when the bar already holds 4 items, and
  disables "move to More" for the last remaining bar item (min 1 in bar).

## Storage

Add one nullable column to `profiles`:

```sql
alter table profiles add column tab_order jsonb;
```

Value shape, keyed by stable tab **ids** (not hrefs or labels):

```json
{ "bar": ["home", "expenses", "fund", "budget"], "more": ["assets", "manage"] }
```

`NULL` → the app falls back to `DEFAULT_LAYOUT`, so no data backfill is needed.
The `alter` is added to `supabase/migrations/0001_schema.sql` and must also be
run manually in the Supabase SQL editor (this repo has no local migration
tooling — see CLAUDE.md).

## Single source of truth — `src/lib/nav/nav-shared.ts`

New **pure**, framework-free module (no Supabase, no `next/headers`), so it is
unit-testable and safe for client components to import. Contains only
serializable data + pure functions:

- `TAB_DEFS` — the 6 tab definitions:
  `{ id, href, i18nKey, iconName, matchPrefixes }`.
  Icons are referenced by **name** (`iconName`) because a pure module should not
  import React components. A `name → lucide component` map lives beside the
  renderers (`BottomTabBar` and the editor), not in the pure module.
- `DEFAULT_LAYOUT: NavLayout` — today's split
  (`bar: [home, expenses, fund, budget]`, `more: [assets, manage]`).
- `NavLayout` type — `{ bar: TabId[]; more: TabId[] }`.
- `parseLayout(raw: unknown): NavLayout` — validates stored JSON and **always
  returns a complete, valid layout**: drops unknown ids, appends any missing
  known ids to More, enforces the ≤4 bar cap (overflow spills to the front of
  More), guarantees ≥1 in bar (falls back to default if bar would be empty).
  This is the primary unit-tested unit.
- `resolveActiveTab(pathname, layout): TabId | 'more'` — replaces the ad-hoc
  active logic in `BottomTabBar`, using each tab's `matchPrefixes`. A tab that
  currently lives in More resolves the "More" slot as active.

`BottomTabBar` and `/more/page.tsx` both render from a resolved `NavLayout`, so
they cannot drift.

## Data flow (SSR, no flash)

1. `getMembership()` gains `tab_order` in its `profiles` select; the `Membership`
   type (`src/lib/data/types.ts`) gains a `tabOrder: NavLayout` field, populated
   by running the raw column through `parseLayout`.
2. The app layout passes `membership.tabOrder` as a prop to `BottomTabBar`.
3. `/more/page.tsx` reads the same membership and renders its `more` list.

All resolution happens server-side, so the correct layout is present on first
paint (no client-side flash).

## Settings editor

A new **"Navigation"** `Section` in `SettingsView` renders a new
`NavOrderEditor` client component (`src/app/(app)/settings/NavOrderEditor.tsx`):

- Two labeled groups: **"In bar"** and **"In More"**.
- Each row: tab icon + localized label + up/down arrows + a bar/More toggle.
- Arrows disabled at the ends of each list; "move to bar" disabled when the bar
  is full (4); "move to More" disabled for the last bar item.
- On any change: update optimistic local state, then call the `updateTabOrder`
  server action. Mirrors the existing `updateLanguage` flow in `SettingsView`
  (uses `useTransition`, then relies on `revalidatePath` for the live bar).

## Server action

`updateTabOrder(layout: NavLayout)` in `src/app/(app)/settings/actions.ts`:
auth-check → normalize with `parseLayout` → `profiles.update({ tab_order })` on
the current user → `revalidatePath('/', 'layout')` so the live `BottomTabBar`
re-renders. Same shape and error handling as `updateLanguage`.

## i18n

New keys in both EN and 中文 dictionaries (`src/i18n/`):
- `nav.assets`, `nav.manage` (bar labels for the two currently-More-only tabs;
  `nav.home/expenses/fund/budget/more` already exist).
- `settings.nav` (section title) and supporting labels
  (`settings.nav.inBar`, `settings.nav.inMore`, and aria-labels for the
  move/reorder controls).

## Tests

`src/lib/nav/nav-shared.test.ts` (vitest + jsdom, colocated per repo convention):

- `parseLayout`: `null`/`undefined`, non-object garbage, unknown ids dropped,
  missing ids appended to More, over-cap bar spills to More, empty-bar input
  falls back to default, already-valid input preserved.
- `resolveActiveTab`: each destination resolves correctly, including
  `/personal` → Home, and `/assets` / `/manage` resolving the "More" slot when
  those tabs live in More (and their own slot when promoted to the bar).

## Files

**New:**
- `src/lib/nav/nav-shared.ts`
- `src/lib/nav/nav-shared.test.ts`
- `src/app/(app)/settings/NavOrderEditor.tsx`

**Edited:**
- `src/components/nav/BottomTabBar.tsx` — render from `NavLayout` prop; use
  `resolveActiveTab`; icon-name map.
- `src/app/(app)/more/page.tsx` — render `more` list from resolved layout.
- `src/lib/data/household.ts` — select `tab_order`, expose `tabOrder`.
- `src/lib/data/types.ts` — add `tabOrder` to `Membership`.
- `src/app/(app)/layout.tsx` — pass `tabOrder` to `BottomTabBar`.
- `src/app/(app)/settings/SettingsView.tsx` — add Navigation section.
- `src/app/(app)/settings/actions.ts` — add `updateTabOrder`.
- `src/i18n/` dictionaries — new keys (EN + 中文).
- `supabase/migrations/0001_schema.sql` — add `tab_order jsonb` to `profiles`.

## Out of scope

- Allowing more than 4 primary tabs in the bar, or emptying out the More page
  entirely (More stays a fixed, pinned slot).
- Reordering/hiding the "More" tab itself.
- Drag-and-drop interaction (arrow buttons + toggle chosen instead; no new deps).
- Per-household (shared) ordering — this is strictly per-user.
