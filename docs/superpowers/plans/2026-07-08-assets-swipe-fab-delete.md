# Assets module amendments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the Assets module in line with Expenses/Fund interaction patterns — FAB add, swipe-to-edit/delete rows, permanent delete, add-transaction bottom sheet, CSV in header — and surface the property opening balance so the hero total reconciles.

**Architecture:** The assets list page stays a server component for data fetching and grouping; each row becomes a small client component (`AssetRow`) carrying the pointer-drag swipe logic copied verbatim from `ExpenseRowCard`. A new `deleteAsset` server action relies on existing FK `on delete cascade` to remove child transactions/commitments. The shared `Fab` gains a button mode so the add-transaction FAB can open a bottom sheet (the existing `AddTxn` form, unchanged, moved into an overlay).

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind 4, Supabase (anon client + RLS), vitest.

## Global Constraints

- Money is always integer cents (`number` in TS); format only at the edge with `MoneyText` / `formatRM`. Copy verbatim from spec.
- All Supabase writes go through the anon client (`@/lib/supabase/server`) and are scoped by `householdId` from `getMembership()` — RLS is the isolation guarantee.
- Every new EN dictionary key MUST have a ZH translation (enforced by `src/i18n/dictionaries.test.ts` locale-parity test).
- Follow existing patterns: `REVEAL_WIDTH = 152` for swipe rows; bottom-sheet overlay classes `fixed inset-0 z-50 flex flex-col justify-end bg-black/30` with inner `mx-auto w-full max-w-[430px] rounded-t-2xl bg-[var(--paper)] p-5 pb-8`; pages that host a `Fab` use `pb-28` on the outer container.
- `ConfirmDialog` must be rendered OUTSIDE the `overflow-hidden`/transformed swipe container so its `fixed` positioning is viewport-relative.
- There is no component/RTL test infrastructure in this repo (tests are pure-logic `*.test.ts`). UI and server-action tasks are verified with `npm run lint` + `npm run build` + manual drive; only Task 1 has a vitest gate.

---

### Task 1: i18n keys

**Files:**
- Modify: `src/i18n/dictionaries.ts` (EN block near line 145; ZH block near line 408)
- Test: `src/i18n/dictionaries.test.ts` (existing locale-parity test — no edits, used as the gate)

**Interfaces:**
- Consumes: nothing.
- Produces: dictionary keys `assets.edit`, `assets.delete`, `assets.confirmDelete`, `asset.openingBalance` (each present in `dictionaries.en` and `dictionaries.zh`), read later via `useT()` / `t(locale, ...)`.

- [ ] **Step 1: Add the four EN keys**

In the EN block, immediately after the line `'assets.editAsset': 'Edit asset',` (currently line 145) add:

```ts
    'assets.edit': 'Edit',
    'assets.delete': 'Delete',
    'assets.confirmDelete': 'Delete this asset? Its transactions and commitments will be removed.',
    'asset.openingBalance': 'Opening balance',
```

- [ ] **Step 2: Add the four ZH keys**

In the ZH block, immediately after the line `'assets.editAsset': '编辑资产',` (currently line 408) add:

```ts
    'assets.edit': '编辑',
    'assets.delete': '删除',
    'assets.confirmDelete': '删除此资产？其交易和承诺项目也会一并删除。',
    'asset.openingBalance': '期初余额',
```

- [ ] **Step 3: Run the locale-parity test to verify it passes**

Run: `npx vitest run src/i18n/dictionaries.test.ts`
Expected: PASS (the "every en key has a zh translation" test stays green; adding an EN key without its ZH pair would fail it).

- [ ] **Step 4: Commit**

```bash
git add src/i18n/dictionaries.ts
git commit -m "i18n(assets): add edit/delete/confirmDelete/openingBalance keys"
```

---

### Task 2: `deleteAsset` server action

**Files:**
- Modify: `src/app/(app)/assets/actions.ts` (append a new exported action)

**Interfaces:**
- Consumes: `getMembership()`, `createClient()` (already imported at top of file).
- Produces: `export async function deleteAsset(input: { id: string }): Promise<{ ok: boolean }>` — consumed by `AssetRow` in Task 4.

- [ ] **Step 1: Add the action**

Append to `src/app/(app)/assets/actions.ts` (after `deleteAssetTransaction`, keeping the file's existing style — same shape as `setAssetStatus`):

```ts
export async function deleteAsset(input: { id: string }): Promise<{ ok: boolean }> {
  const m = await getMembership()
  if (!m) return { ok: false }
  const supabase = await createClient()
  // asset_transactions.asset_id and monthly_commitments.asset_id are ON DELETE CASCADE,
  // so removing the asset removes its transactions and commitments automatically.
  const { error } = await supabase.from('assets')
    .delete().eq('id', input.id).eq('household_id', m.householdId)
  if (error) { console.error('deleteAsset:', error.message); return { ok: false } }
  revalidatePath('/assets'); revalidatePath('/')
  return { ok: true }
}
```

- [ ] **Step 2: Verify it type-checks / builds**

Run: `npm run lint`
Expected: PASS, no new errors referencing `actions.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/assets/actions.ts
git commit -m "feat(assets): deleteAsset server action (cascades txns + commitments)"
```

---

### Task 3: Extend `Fab` with a button mode

**Files:**
- Modify: `src/components/ui/Fab.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `Fab` now accepts `{ href?: string; label?: string; onClick?: () => void }`. When `onClick` is supplied it renders a `<button>`; otherwise a `<Link href>` (unchanged behavior for existing callers `Fab href="/expenses/add"`, `Fab href="/assets/new"`). Consumed by Task 4 (href form) and Task 5 (onClick form).

- [ ] **Step 1: Replace the component body**

Replace the whole `export function Fab(...)` in `src/components/ui/Fab.tsx` with (imports `Link` and `Plus` at the top stay as-is):

```tsx
export function Fab({ href, label, onClick }: { href?: string; label?: string; onClick?: () => void }) {
  const className = label
    ? 'pressable pointer-events-auto flex h-14 min-h-[44px] items-center gap-2 rounded-full bg-[var(--primary-btn)] px-5 text-sm font-bold text-white shadow-[0_10px_24px_-6px_var(--primary)] active:shadow-[0_4px_12px_-6px_var(--primary)]'
    : 'pressable pointer-events-auto flex h-14 w-14 min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-[var(--primary-btn)] text-white shadow-[0_10px_24px_-6px_var(--primary)] active:shadow-[0_4px_12px_-6px_var(--primary)]'
  const inner = (
    <>
      <Plus size={22} strokeWidth={2.5} />
      {label && <span>{label}</span>}
    </>
  )
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[100px] z-40">
      <div className="mx-auto flex max-w-[430px] justify-end px-[18px]">
        {onClick ? (
          <button type="button" onClick={onClick} aria-label={label} className={className}>
            {inner}
          </button>
        ) : (
          <Link href={href!} aria-label={label} className={className}>
            {inner}
          </Link>
        )}
      </div>
    </div>
  )
}
```

Keep the existing explanatory comment block above the function.

- [ ] **Step 2: Verify existing FAB callers still build**

Run: `npm run lint`
Expected: PASS, no errors in `Fab.tsx` or its callers (`ExpensesView.tsx`, `FundView.tsx`, etc.).

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/Fab.tsx
git commit -m "feat(ui): Fab supports onClick button mode"
```

---

### Task 4: Assets list — FAB add + swipe-to-reveal Edit/Delete rows

**Files:**
- Create: `src/app/(app)/assets/AssetRow.tsx`
- Modify: `src/app/(app)/assets/page.tsx`

**Interfaces:**
- Consumes: `deleteAsset` (Task 2), `Fab` (Task 3), keys `assets.edit` / `assets.delete` / `assets.confirmDelete` (Task 1), plus existing `error.delete_failed`, `common.cancel`, `assets.key.*`.
- Produces: `export function AssetRow({ asset }: { asset: Asset & { key: KeyFigure } })`.

- [ ] **Step 1: Create `AssetRow.tsx`**

Create `src/app/(app)/assets/AssetRow.tsx` (swipe mechanics mirror `ExpenseRowCard`; `TYPE_ICON`, `TYPE_TINT`, `assetMetaText` move here from `page.tsx`; a tap navigates to the detail page):

```tsx
'use client'
import { useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { useT } from '@/i18n/LocaleProvider'
import type { Asset, AssetType, KeyFigure } from '@/lib/data/assets-shared'
import { IconTile } from '@/components/ui/IconTile'
import { MoneyText } from '@/components/ui/MoneyText'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Spinner } from '@/components/ui/Spinner'
import { deleteAsset } from './actions'

const TYPE_ICON: Record<AssetType, string> = {
  property: 'Building',
  vehicle: 'Car',
  investment: 'ShieldCheck',
  other: 'PiggyBank',
}
const TYPE_TINT: Record<AssetType, string> = {
  property: 'var(--peach)',
  vehicle: 'var(--info-bg)',
  investment: 'var(--positive-bg)',
  other: 'var(--subtle)',
}

const REVEAL_WIDTH = 152 // px — two 76px action buttons behind each row

function assetMetaText(asset: Asset): string | null {
  const md = asset.metadata ?? {}
  if (asset.type === 'property') {
    return typeof md.address === 'string' && md.address.trim() ? md.address : null
  }
  if (asset.type === 'vehicle') {
    return typeof md.plate === 'string' && md.plate.trim() ? md.plate : null
  }
  if (asset.type === 'investment') {
    const years = md.years
    if (typeof years === 'number' && years > 0) return `${years}-year plan`
    return asset.ownerMemberCode
  }
  return typeof md.notes === 'string' && md.notes.trim() ? md.notes : null
}

export function AssetRow({ asset }: { asset: Asset & { key: KeyFigure } }) {
  const t = useT()
  const router = useRouter()
  const meta = assetMetaText(asset)
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error, setError] = useState(false)
  const dragState = useRef<{ startX: number; startDragX: number; moved: boolean } | null>(null)

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    dragState.current = { startX: e.clientX, startDragX: dragX, moved: false }
    setDragging(true)
  }
  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const ds = dragState.current
    if (!ds) return
    const delta = e.clientX - ds.startX
    if (Math.abs(delta) > 8) ds.moved = true
    const next = Math.min(0, Math.max(-REVEAL_WIDTH, ds.startDragX + delta))
    setDragX(next)
  }
  function onPointerUp() {
    const ds = dragState.current
    if (!ds) return
    dragState.current = null
    setDragging(false)
    // A tap (no real drag) on a closed row opens the asset detail page.
    if (!ds.moved && ds.startDragX === 0) {
      setDragX(0)
      router.push(`/assets/${asset.id}`)
      return
    }
    setDragX((x) => (x < -REVEAL_WIDTH / 2 ? -REVEAL_WIDTH : 0))
  }
  function onPointerCancel() {
    const ds = dragState.current
    if (!ds) return
    dragState.current = null
    setDragging(false)
    setDragX((x) => (x < -REVEAL_WIDTH / 2 ? -REVEAL_WIDTH : 0))
  }

  return (
    <>
      <div className="relative overflow-hidden rounded-[16px]">
        {/* revealed actions, sit behind the row */}
        <div className="absolute inset-y-0 right-0 flex" style={{ width: REVEAL_WIDTH }}>
          <button
            type="button"
            onClick={() => {
              setDragX(0)
              router.push(`/assets/${asset.id}/edit`)
            }}
            className="pressable-opacity flex h-full flex-1 items-center justify-center text-sm font-bold text-white"
            style={{ background: 'var(--pending-text)' }}
          >
            {t('assets.edit')}
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={() => setConfirmOpen(true)}
            className="pressable-opacity flex h-full flex-1 items-center justify-center text-sm font-bold text-white"
            style={{ background: 'var(--danger)' }}
          >
            {deleting ? <Spinner /> : t('assets.delete')}
          </button>
        </div>

        {/* foreground row — drag horizontally to reveal actions */}
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          className="relative flex touch-pan-y items-center gap-3 rounded-[16px] bg-[var(--surface)] p-4 shadow-[0_3px_10px_oklch(0.5_0.05_45/.05)]"
          style={{ transform: `translateX(${dragX}px)`, transition: dragging ? 'none' : 'transform 160ms ease' }}
        >
          <IconTile name={TYPE_ICON[asset.type]} tint={TYPE_TINT[asset.type]} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-[var(--ink)]">{asset.name}</p>
            {meta && <p className="truncate text-xs text-[var(--muted)]">{meta}</p>}
          </div>
          <div className="flex shrink-0 flex-col items-end">
            <MoneyText cents={asset.key.amountCents} className="text-sm font-bold text-[var(--ink-head)]" />
            <span className="text-xs font-semibold text-[var(--muted)]">{t(`assets.key.${asset.key.label}`)}</span>
          </div>
          <ChevronRight size={18} strokeWidth={2} className="shrink-0 text-[var(--faint)]" />
        </div>
      </div>
      {error && (
        <p role="alert" className="px-1 text-xs font-semibold text-[var(--danger)]">
          {t('error.delete_failed')}
        </p>
      )}
      {confirmOpen && (
        <ConfirmDialog
          message={t('assets.confirmDelete')}
          confirmLabel={t('assets.delete')}
          cancelLabel={t('common.cancel')}
          busy={deleting}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={async () => {
            setDeleting(true)
            const res = await deleteAsset({ id: asset.id })
            if (!res.ok) {
              setDeleting(false)
              setConfirmOpen(false)
              setError(true)
            }
            // on success the row is removed by revalidatePath; this component unmounts
          }}
        />
      )}
    </>
  )
}
```

- [ ] **Step 2: Rewrite `page.tsx` to use `AssetRow` + `Fab`**

Replace the entire contents of `src/app/(app)/assets/page.tsx` with (drops the header add pill and the local `AssetCard`/`TYPE_*`/`assetMetaText`; adds `Fab`; `pb-6` → `pb-28`):

```tsx
import { getAssetsList } from '@/lib/data/assets'
import { getMembership } from '@/lib/data/household'
import { t } from '@/i18n'
import type { Asset, KeyFigure } from '@/lib/data/assets-shared'
import { splitByStatus } from '@/lib/data/assets-shared'
import { Fab } from '@/components/ui/Fab'
import { AssetRow } from './AssetRow'

export default async function AssetsPage() {
  const [groups, membership] = await Promise.all([getAssetsList(), getMembership()])
  const locale = membership?.language ?? 'en'

  const activeGroups = groups
    .map((g) => ({ type: g.type, assets: splitByStatus(g.assets).active }))
    .filter((g) => g.assets.length > 0)
  const closedAssets = groups.flatMap((g) => splitByStatus(g.assets).closed)

  return (
    // pb-28 clears the fixed FAB so the last rows scroll past it.
    <div className="flex flex-col gap-5 pb-28">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-[var(--ink-head)]">{t(locale, 'assets.title')}</h1>
      </header>

      {activeGroups.length === 0 && closedAssets.length === 0 ? (
        <p className="py-10 text-center text-sm font-semibold text-[var(--faint)]">{t(locale, 'assets.empty')}</p>
      ) : (
        <div className="flex flex-col gap-5">
          {activeGroups.map((g) => (
            <div key={g.type} className="flex flex-col gap-2">
              <span className="px-1 text-xs font-bold tracking-wide text-[var(--muted)] uppercase">
                {t(locale, `assets.type.${g.type}`)}
              </span>
              <div className="flex flex-col gap-2">
                {g.assets.map((a) => (
                  <AssetRow key={a.id} asset={a} />
                ))}
              </div>
            </div>
          ))}

          {closedAssets.length > 0 && <ClosedAssets assets={closedAssets} locale={locale} />}
        </div>
      )}

      <Fab href="/assets/new" />
    </div>
  )
}

function ClosedAssets({ assets, locale }: { assets: (Asset & { key: KeyFigure })[]; locale: 'en' | 'zh' }) {
  return (
    <details className="flex flex-col gap-2">
      <summary className="cursor-pointer list-none px-1 text-xs font-bold tracking-wide text-[var(--muted)] uppercase">
        {t(locale, 'assets.closed')} · {assets.length}
      </summary>
      <div className="mt-2 flex flex-col gap-2 opacity-60">
        {assets.map((a) => (
          <AssetRow key={a.id} asset={a} />
        ))}
      </div>
    </details>
  )
}
```

- [ ] **Step 3: Verify build + lint**

Run: `npm run lint && npm run build`
Expected: PASS. No unused-import warnings (the old `Link`, `Plus`, `ChevronRight`, `Card`, `IconTile`, `MoneyText`, `AssetType` imports are gone from `page.tsx`).

- [ ] **Step 4: Manual drive**

Run `npm run dev`, open `/assets`:
- FAB sits bottom-right, hugging the phone frame; tapping it opens `/assets/new`.
- Swipe a row left → Edit + Delete revealed; Edit → `/assets/{id}/edit`; Delete → confirm dialog with the cascade warning; confirm → row disappears.
- Tap a row (no drag) → opens `/assets/{id}`.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/assets/AssetRow.tsx src/app/\(app\)/assets/page.tsx
git commit -m "feat(assets): FAB add + swipe-to-edit/delete rows on the list"
```

---

### Task 5: Asset detail — CSV in header + add-transaction FAB/bottom sheet

**Files:**
- Modify: `src/app/(app)/assets/[id]/page.tsx`
- Modify: `src/app/(app)/assets/[id]/AddTxn.tsx`

**Interfaces:**
- Consumes: `Fab` onClick mode (Task 3), existing `asset.exportCsv`, `asset.addTxn`, `common.close` keys.
- Produces: no new exports (component behavior changes only).

- [ ] **Step 1: Move CSV to header, drop the edit pencil and bottom CSV block in `page.tsx`**

In `src/app/(app)/assets/[id]/page.tsx`:

1. Change the outer container from `className="flex flex-col gap-5 pb-6"` to `className="flex flex-col gap-5 pb-28"`.

2. Replace the header's trailing edit-pencil `<Link>` (the block starting `<Link href={\`/assets/${asset.id}/edit\`}` ... ending `</Link>` with the `<Pencil size={18} />`) with a Download CSV icon anchor:

```tsx
        <a
          href={`/report/export?type=asset&id=${asset.id}`}
          download
          aria-label={t(locale, 'asset.exportCsv')}
          className="pressable-opacity grid h-11 w-11 shrink-0 place-items-center text-[var(--muted)]"
        >
          <Download size={18} />
        </a>
```

3. Delete the full-width CSV `<a ...>` block near the bottom of the file (the one containing `<Download size={16} .../>` and `{t(locale, 'asset.exportCsv')}`). Keep the `<AddTxn assetId={asset.id} defaultDirection={defaultDirection} />` line where it is — it now renders the FAB + sheet.

4. Imports: `Download` is already imported and still used (header). `Pencil` is still used by `GenericBody` — keep it. Leave the top imports otherwise unchanged.

- [ ] **Step 2: Refactor `AddTxn.tsx` into a FAB that opens a bottom sheet**

Replace the `if (!open) { return <button ...> }` trigger and the outer `<form ...>` wrapper so the form lives in a bottom sheet opened by a `Fab`. All form state and fields stay identical. Replace the component's `return (...)` region — from `if (!open) {` down to the final closing `)` — with:

```tsx
  return (
    <>
      <Fab onClick={() => setOpen(true)} />
      {open && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/30"
          onClick={() => setOpen(false)}
        >
          <div
            className="mx-auto w-full max-w-[430px] rounded-t-2xl bg-[var(--paper)] p-5 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-[var(--ink-head)]">{t('asset.addTxn')}</span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label={t('common.close')}
                  className="pressable-opacity grid h-11 w-11 place-items-center text-xl text-[var(--muted)]"
                >
                  ×
                </button>
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-[var(--muted)]">{t('asset.form.date')}</span>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--ink)] outline-none"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-[var(--muted)]">{t('asset.form.description')}</span>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--ink)] outline-none placeholder:text-[var(--faint)]"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-[var(--muted)]">{t('asset.form.amount')}</span>
                <div className="flex items-center gap-2 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3">
                  <span className="text-sm font-semibold text-[var(--muted)]">RM</span>
                  <input
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="flex-1 bg-transparent text-base text-[var(--ink)] outline-none placeholder:text-[var(--faint)]"
                  />
                </div>
              </label>

              <div className="flex gap-2">
                {(['in', 'out'] as const).map((d) => {
                  const selected = direction === d
                  const color = d === 'in' ? 'var(--positive-text)' : 'var(--primary)'
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDirection(d)}
                      className="pressable min-h-[44px] flex-1 rounded-xl border py-2.5 text-sm font-semibold"
                      style={{
                        borderColor: selected ? color : 'var(--hairline)',
                        background: selected ? color : 'var(--surface)',
                        color: selected ? 'white' : 'var(--ink)',
                      }}
                    >
                      {t(d === 'in' ? 'asset.in' : 'asset.out')}
                    </button>
                  )
                })}
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-[var(--muted)]">{t('asset.form.txnType')}</span>
                <input
                  value={txnType}
                  onChange={(e) => setTxnType(e.target.value)}
                  className="w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--ink)] outline-none placeholder:text-[var(--faint)]"
                />
              </label>

              {error && (
                <p role="alert" className="text-sm font-semibold text-[var(--danger)]">
                  {t('error.save_failed')}
                </p>
              )}

              <button
                type="submit"
                disabled={!canSubmit}
                aria-busy={submitting}
                className="pressable flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary-btn)] py-3 text-sm font-bold text-white disabled:opacity-40"
              >
                {submitting && <Spinner />}
                {t('asset.form.save')}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
```

Then add the `Fab` import at the top of `AddTxn.tsx`:

```tsx
import { Fab } from '@/components/ui/Fab'
```

(All state, `handleSubmit`, `cents`, `canSubmit` above the `return` are unchanged.)

- [ ] **Step 3: Verify build + lint**

Run: `npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 4: Manual drive**

Open an asset detail page:
- Header top-right shows the Download icon; clicking it downloads the CSV. No edit pencil in the header.
- No full-width CSV button at the bottom.
- Add-transaction FAB bottom-right; tapping it slides up the form sheet; tapping the backdrop or × closes it; saving adds a transaction and the sheet closes (list refreshes).

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/assets/\[id\]/page.tsx src/app/\(app\)/assets/\[id\]/AddTxn.tsx
git commit -m "feat(assets): add-txn FAB + bottom sheet; CSV download in detail header"
```

---

### Task 6: Property detail — Opening balance line

**Files:**
- Modify: `src/app/(app)/assets/[id]/PropertyBody.tsx`

**Interfaces:**
- Consumes: `asset.openingBalanceCents`, `asset.commitments`; key `asset.openingBalance` (Task 1); existing `Card`, `MoneyText`, `useT`.
- Produces: no new exports.

- [ ] **Step 1: Add the opening-balance flag**

In `PropertyBody`, just after `const balance = runningBalanceCents(asset.openingBalanceCents, txns)` add:

```tsx
  const hasOpening = (asset.openingBalanceCents ?? 0) !== 0
```

- [ ] **Step 2: Render the line at the bottom of the transaction list**

Replace the transaction-list conditional block:

```tsx
      {txns.length === 0 ? (
        <p className="py-10 text-center text-sm font-semibold text-[var(--faint)]">{t('asset.empty')}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {txns.map((txn) => {
```

...changing the guard to also account for the opening line, and appending the opening row after the `{txns.map(...)}` block. The block becomes:

```tsx
      {txns.length === 0 && !hasOpening ? (
        <p className="py-10 text-center text-sm font-semibold text-[var(--faint)]">{t('asset.empty')}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {txns.map((txn) => {
```

...(the entire existing `txns.map` body is unchanged)...

and immediately before the closing `</div>` that ends this list container (after the `})}` that closes `txns.map`), insert:

```tsx
          {hasOpening && (
            <Card className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-[var(--muted)]">{t('asset.openingBalance')}</span>
              <MoneyText cents={asset.openingBalanceCents ?? 0} className="text-sm font-bold text-[var(--muted)]" />
            </Card>
          )}
```

- [ ] **Step 3: Verify build + lint**

Run: `npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 4: Manual drive**

Open the TreeO property:
- A muted "Opening balance" row (RM 46,013.81) shows at the bottom of the transaction list.
- The hero balance still reads RM 54,342.03 (opening + net of transactions).

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/assets/\[id\]/PropertyBody.tsx
git commit -m "feat(assets): show opening balance line in property transaction list"
```

---

## Self-Review

**Spec coverage:**
- Spec §1 (Add asset FAB) → Task 4 (Fab + pb-28, header pill removed).
- Spec §2 (swipe Edit/Delete) → Task 4 (`AssetRow`).
- Spec §3 (`deleteAsset` cascade) → Task 2.
- Spec §4 (add-txn FAB sheet + CSV header, Fab onClick) → Task 3 (Fab) + Task 5.
- Spec §5 (opening balance line) → Task 6.
- Spec §6 (i18n keys) → Task 1.
- Balance investigation → already answered in chat; no code (opening-balance line makes it visible, Task 6).

**Placeholder scan:** No TBD/TODO; every code step shows full code. ✔

**Type consistency:** `deleteAsset(input: { id: string }): Promise<{ ok: boolean }>` defined in Task 2, called identically in Task 4. `Fab({ href?, label?, onClick? })` defined in Task 3, used as `href` form (Task 4) and `onClick` form (Task 5). `AssetRow({ asset })` defined and consumed within Task 4. `asset.openingBalanceCents` is `number | null` — guarded by `hasOpening` and coalesced with `?? 0` in Task 6. ✔
