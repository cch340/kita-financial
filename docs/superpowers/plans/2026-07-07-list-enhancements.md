# Expenses & Fund List Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a delete-confirmation dialog, an in-place Manage bottom sheet, and a view-only row-detail bottom sheet to the Expenses and Fund list screens.

**Architecture:** Pure client-side UI work. One new reusable dialog primitive (`ConfirmDialog`), three new bottom-sheet components modeled on the existing `FilterSheet`, small edits to the two row cards' pointer handlers to distinguish tap from swipe, plus i18n keys. No data-layer, server-action, or DB changes. The `/manage` full page is removed and its UI re-hosted as a sheet on the Expenses screen; `ManageSection` and `manage/actions.ts` are kept and reused.

**Tech Stack:** Next.js 16 App Router, React 19 client components, Tailwind 4 with CSS custom properties, lucide-react icons, vitest for the i18n parity test.

## Global Constraints

- **Money:** integer cents everywhere; format for display only via `MoneyText` / `formatRM`. Copied verbatim from CLAUDE.md.
- **i18n:** every EN key must have a 中文 translation (enforced by `src/i18n/dictionaries.test.ts`). Use `t(...)` from `@/i18n/LocaleProvider` in client components.
- **Design tokens:** use CSS custom properties (`var(--paper)`, `var(--danger)`, `var(--hairline)`, `var(--muted)`, `var(--ink)`, `var(--ink-head)`, `var(--surface)`, `var(--primary)`) — never hardcoded colors.
- **This repo does not unit-test React components.** UI tasks are verified with `npm run lint`, `npm run build`, and manual checks in `npm run dev`. Only genuine pure logic / i18n gets a vitest cycle.
- **Bottom-sheet shell pattern** (copy from `src/app/(app)/expenses/FilterSheet.tsx`): outer `fixed inset-0 z-50 flex flex-col justify-end bg-black/30` with `onClick={onClose}`; inner `mx-auto w-full max-w-[430px] rounded-t-2xl bg-[var(--paper)] p-5 pb-8` with `onClick={(e) => e.stopPropagation()}`.
- **Fixed-overlay caveat:** the row card's foreground uses `transform: translateX(...)`, which makes `position: fixed` descendants relative to the card rather than the viewport. Any overlay (dialog / detail sheet) MUST be rendered as a sibling of the card root (via a fragment), never nested inside the transformed foreground or the `overflow-hidden` wrapper.

---

## File Structure

- Create: `src/components/ui/ConfirmDialog.tsx` — reusable centered confirm modal.
- Create: `src/app/(app)/expenses/ManageSheet.tsx` — bottom sheet wrapping the three `ManageSection` blocks.
- Create: `src/app/(app)/expenses/ExpenseDetailSheet.tsx` — view-only expense detail bottom sheet.
- Create: `src/app/(app)/fund/FundDetailSheet.tsx` — view-only fund detail bottom sheet.
- Modify: `src/i18n/dictionaries.ts` — new EN + 中文 keys.
- Modify: `src/app/(app)/expenses/ExpensesView.tsx` — header Manage button, delete confirm, tap-to-detail.
- Modify: `src/app/(app)/fund/FundView.tsx` — delete confirm, tap-to-detail.
- Modify: `src/app/(app)/more/page.tsx` — remove the Manage entry.
- Delete: `src/app/(app)/manage/page.tsx` — the full Manage page (keep `ManageSection.tsx` and `actions.ts`).

---

## Task 1: i18n keys

**Files:**
- Modify: `src/i18n/dictionaries.ts`
- Test: `src/i18n/dictionaries.test.ts` (existing parity test)

**Interfaces:**
- Produces the following keys (used by later tasks): `common.cancel`, `expenses.confirmDelete`, `fund.confirmDelete`, `detail.title`, `detail.note`, `fund.period`. Reused existing keys: `expenses.delete`, `fund.delete`, `common.close`, `manage.title`, `manage.categories`, `manage.vendors`, `manage.locations`, `add.date`, `add.amount`, `add.vendor`, `add.location`, `expenses.category`, `fund.paidBy`.

- [ ] **Step 1: Add the new EN keys**

In `src/i18n/dictionaries.ts`, inside the `en:` block, add (place near related keys):

```ts
    'common.cancel': 'Cancel',
    'expenses.confirmDelete': 'Delete this expense?',
    'fund.confirmDelete': 'Delete this contribution?',
    'detail.title': 'Details',
    'detail.note': 'Note',
    'fund.period': 'Period',
```

- [ ] **Step 2: Add the matching 中文 keys**

In the same file, inside the `zh:` block, add:

```ts
    'common.cancel': '取消',
    'expenses.confirmDelete': '删除这笔支出？',
    'fund.confirmDelete': '删除这笔缴款？',
    'detail.title': '详情',
    'detail.note': '备注',
    'fund.period': '期间',
```

- [ ] **Step 3: Run the parity test to verify it passes**

Run: `npx vitest run src/i18n/dictionaries.test.ts`
Expected: PASS — "every en key (except test.*) has a zh translation" is green (proves no key is missing a 中文 translation).

- [ ] **Step 4: Commit**

```bash
git add src/i18n/dictionaries.ts
git commit -m "i18n: add keys for delete-confirm and detail sheets

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: ConfirmDialog primitive + wire delete on both lists

**Files:**
- Create: `src/components/ui/ConfirmDialog.tsx`
- Modify: `src/app/(app)/expenses/ExpensesView.tsx` (the `ExpenseRowCard` component)
- Modify: `src/app/(app)/fund/FundView.tsx` (the `FundRecordCard` component)

**Interfaces:**
- Consumes `common.cancel`, `expenses.confirmDelete`, `fund.confirmDelete` from Task 1; existing `deleteExpenseAction` (`(id: string) => Promise<{ ok: boolean }>`) and `deleteFundRecordAction` (`(id: string) => Promise<{ ok: boolean }>`).
- Produces `ConfirmDialog` (default-styled danger confirm modal):

```ts
function ConfirmDialog(props: {
  title?: string
  message: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
  busy?: boolean
}): JSX.Element
```

- [ ] **Step 1: Create `src/components/ui/ConfirmDialog.tsx`**

```tsx
'use client'
import { Spinner } from './Spinner'

/** Centered confirm modal (scrim + card). Danger-styled confirm button.
 *  Distinct from ConfirmButton (two-tap inline). Render it OUTSIDE any
 *  transformed/overflow-hidden ancestor so `fixed` is viewport-relative. */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  busy,
}: {
  title?: string
  message: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
  busy?: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6" onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[320px] rounded-2xl bg-[var(--paper)] p-5 shadow-[0_10px_40px_oklch(0.4_0.05_45/.2)]"
      >
        {title && <h2 className="text-lg font-extrabold text-[var(--ink-head)]">{title}</h2>}
        <p className="mt-1 text-sm font-semibold text-[var(--muted)]">{message}</p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="pressable flex-1 rounded-xl border border-[var(--hairline)] py-3 font-bold text-[var(--ink)] disabled:opacity-40"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            aria-busy={busy}
            className="pressable flex flex-1 items-center justify-center rounded-xl py-3 font-bold text-white disabled:opacity-60"
            style={{ background: 'var(--danger)' }}
          >
            {busy ? <Spinner /> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire it into `ExpenseRowCard` in `ExpensesView.tsx`**

Add the import near the other UI imports:

```tsx
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
```

In `ExpenseRowCard`, add state alongside the existing `useState` calls:

```tsx
  const [confirmOpen, setConfirmOpen] = useState(false)
```

Change the swipe-revealed delete button's `onClick` (currently runs the action directly) to just open the dialog:

```tsx
        <button
          type="button"
          disabled={deleting}
          onClick={() => setConfirmOpen(true)}
          className="pressable-opacity flex h-full flex-1 items-center justify-center text-sm font-bold text-white"
          style={{ background: 'var(--danger)' }}
        >
          {deleting ? <Spinner /> : t('expenses.delete')}
        </button>
```

Wrap the card's returned JSX in a fragment and render the dialog as a sibling of the outer `<div className="relative overflow-hidden rounded-[16px]">` (NOT inside it — see the fixed-overlay caveat). At the end of the return:

```tsx
  return (
    <>
      <div className="relative overflow-hidden rounded-[16px]">
        {/* …existing actions + foreground row unchanged… */}
      </div>
      {confirmOpen && (
        <ConfirmDialog
          message={t('expenses.confirmDelete')}
          confirmLabel={t('expenses.delete')}
          cancelLabel={t('common.cancel')}
          busy={deleting}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={async () => {
            setDeleting(true)
            const res = await deleteExpenseAction(row.id)
            if (!res.ok) {
              setDeleting(false)
              setConfirmOpen(false)
              onDeleteError()
            }
            // on success the row is removed by revalidatePath; dialog unmounts with it
          }}
        />
      )}
    </>
  )
```

- [ ] **Step 3: Wire it into `FundRecordCard` in `FundView.tsx`**

Add the import:

```tsx
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
```

In `FundRecordCard`, add:

```tsx
  const [confirmOpen, setConfirmOpen] = useState(false)
```

Change the delete button's `onClick` to `() => setConfirmOpen(true)` (keep `disabled={deleting}` and the `{deleting ? <Spinner /> : t('fund.delete')}` label). Wrap the return in a fragment and add the dialog as a sibling of the outer wrapper:

```tsx
      {confirmOpen && (
        <ConfirmDialog
          message={t('fund.confirmDelete')}
          confirmLabel={t('fund.delete')}
          cancelLabel={t('common.cancel')}
          busy={deleting}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={async () => {
            setDeleting(true)
            const res = await deleteFundRecordAction(row.id)
            if (!res.ok) {
              setDeleting(false)
              setConfirmOpen(false)
              onDeleteError()
            }
          }}
        />
      )}
```

- [ ] **Step 4: Verify build + lint pass**

Run: `npm run lint && npm run build`
Expected: both succeed with no errors for the modified files.

- [ ] **Step 5: Manual check**

Run `npm run dev`, open `/expenses` and `/fund`. Swipe a row left, tap Delete → the centered dialog appears. Cancel dismisses with the row intact; Delete removes the record and shows the spinner while working.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/ConfirmDialog.tsx "src/app/(app)/expenses/ExpensesView.tsx" "src/app/(app)/fund/FundView.tsx"
git commit -m "feat: confirm dialog before deleting expense/fund records

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Manage bottom sheet on Expenses + remove /manage page

**Files:**
- Create: `src/app/(app)/expenses/ManageSheet.tsx`
- Modify: `src/app/(app)/expenses/ExpensesView.tsx` (header)
- Modify: `src/app/(app)/more/page.tsx`
- Delete: `src/app/(app)/manage/page.tsx`

**Interfaces:**
- Consumes existing `ManageSection` (`{ kind: 'category' | 'vendor' | 'location'; title: string; items: CatalogItem[] }`) from `src/app/(app)/manage/ManageSection.tsx`, and the `categories`/`vendors`/`locations: CatalogItem[]` props the Expenses page already passes into `ExpensesView`.
- Produces `ManageSheet`:

```ts
function ManageSheet(props: {
  categories: CatalogItem[]
  vendors: CatalogItem[]
  locations: CatalogItem[]
  onClose: () => void
}): JSX.Element
```

- [ ] **Step 1: Create `src/app/(app)/expenses/ManageSheet.tsx`**

```tsx
'use client'
import { useT } from '@/i18n/LocaleProvider'
import type { CatalogItem } from '@/lib/data/catalog-shared'
import { ManageSection } from '../manage/ManageSection'

/** Bottom sheet hosting the catalog manager (categories / vendors / locations).
 *  ManageSection already calls router.refresh() after each mutation, which
 *  re-runs the Expenses server page and refreshes both catalogs and rows. */
export function ManageSheet({
  categories,
  vendors,
  locations,
  onClose,
}: {
  categories: CatalogItem[]
  vendors: CatalogItem[]
  locations: CatalogItem[]
  onClose: () => void
}) {
  const t = useT()
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/30" onClick={onClose}>
      <div
        className="mx-auto w-full max-w-[430px] rounded-t-2xl bg-[var(--paper)] p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-[var(--ink-head)]">{t('manage.title')}</h2>
          <button type="button" onClick={onClose} className="pressable-opacity text-sm font-bold text-[var(--primary)]">
            {t('common.close')}
          </button>
        </div>
        <div className="flex max-h-[70vh] flex-col gap-5 overflow-y-auto">
          <ManageSection kind="category" title={t('manage.categories')} items={categories} />
          <ManageSection kind="vendor" title={t('manage.vendors')} items={vendors} />
          <ManageSection kind="location" title={t('manage.locations')} items={locations} />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add the Manage button + sheet to `ExpensesView.tsx`**

Update the lucide import to add `Tags`:

```tsx
import { SlidersHorizontal, Tags } from 'lucide-react'
```

Add the import and state:

```tsx
import { ManageSheet } from './ManageSheet'
```

```tsx
  const [manageOpen, setManageOpen] = useState(false)
```

Replace the single Filter button in the header with the Filter button plus a Manage icon button, grouped:

```tsx
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-[var(--ink-head)]">{t('expenses.title')}</h1>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setSheetOpen(true)}
            className="pressable-opacity flex min-h-[40px] items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-3 text-sm font-bold text-[var(--ink)]">
            <SlidersHorizontal size={16} />
            {t('expenses.filter')}{activeCount > 0 ? ` · ${activeCount}` : ''}
          </button>
          <button type="button" onClick={() => setManageOpen(true)} aria-label={t('manage.title')}
            className="pressable-opacity grid h-10 w-10 place-items-center rounded-full border border-[var(--hairline)] bg-[var(--surface)] text-[var(--ink)]">
            <Tags size={16} />
          </button>
        </div>
      </div>
```

Render the sheet next to the existing `FilterSheet` render at the bottom of the component:

```tsx
      {manageOpen && (
        <ManageSheet categories={categories} vendors={vendors} locations={locations}
          onClose={() => setManageOpen(false)} />
      )}
```

- [ ] **Step 3: Remove the Manage entry from `src/app/(app)/more/page.tsx`**

Drop the `/manage` item and the now-unused `SlidersHorizontal` import, leaving Assets:

```tsx
import Link from 'next/link'
import { LayoutGrid, ChevronRight } from 'lucide-react'
import { getMembership } from '@/lib/data/household'
import { t } from '@/i18n'

export default async function MorePage() {
  const m = await getMembership()
  const locale = m?.language ?? 'en'
  const items = [
    { href: '/assets', label: t(locale, 'more.assets'), Icon: LayoutGrid },
  ]
  return (
    <div className="flex flex-col gap-5 pb-6">
      <h1 className="text-2xl font-extrabold text-[var(--ink-head)]">{t(locale, 'more.title')}</h1>
      <div className="flex flex-col gap-2">
        {items.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className="pressable flex min-h-[56px] items-center gap-3 rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--subtle)]">
              <Icon size={20} className="text-[var(--ink)]" />
            </span>
            <span className="flex-1 text-sm font-bold text-[var(--ink)]">{label}</span>
            <ChevronRight size={18} className="text-[var(--faint)]" />
          </Link>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Delete the `/manage` page**

```bash
git rm "src/app/(app)/manage/page.tsx"
```

Leave `src/app/(app)/manage/ManageSection.tsx` and `src/app/(app)/manage/actions.ts` in place — both are still used by `ManageSheet`.

- [ ] **Step 5: Verify build + lint pass**

Run: `npm run lint && npm run build`
Expected: both succeed. Confirm there are no remaining imports of the deleted page and no unused-import errors in `more/page.tsx`.

- [ ] **Step 6: Manual check**

Run `npm run dev`. On `/expenses`, tap the new Tags button right of Filter → the Manage sheet opens; add/rename/delete a category and confirm the change is reflected (rows and filter options refresh). Visit `/more` → only Assets remains; navigating to `/manage` directly is a 404.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(app)/expenses/ManageSheet.tsx" "src/app/(app)/expenses/ExpensesView.tsx" "src/app/(app)/more/page.tsx"
git commit -m "feat: manage lists as a sheet on Expenses; drop /manage page

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Row detail bottom sheets + tap-vs-swipe detection

**Files:**
- Create: `src/app/(app)/expenses/ExpenseDetailSheet.tsx`
- Create: `src/app/(app)/fund/FundDetailSheet.tsx`
- Modify: `src/app/(app)/expenses/ExpensesView.tsx` (`ExpenseRowCard` pointer handlers)
- Modify: `src/app/(app)/fund/FundView.tsx` (`FundRecordCard` pointer handlers)

**Interfaces:**
- Consumes `detail.title`, `detail.note`, `fund.period` from Task 1; `ExpenseRow` (`src/lib/data/types.ts`), `FundRecord` (`src/lib/data/fund-shared.ts`), `MoneyText`, `MemberAvatar`, and `monthShort` (`src/lib/data/summary.ts`).
- Produces `ExpenseDetailSheet({ row: ExpenseRow; onClose: () => void })` and `FundDetailSheet({ row: FundRecord; locale: 'en' | 'zh'; onClose: () => void })`.

- [ ] **Step 1: Create `src/app/(app)/expenses/ExpenseDetailSheet.tsx`**

```tsx
'use client'
import type { ReactNode } from 'react'
import { useT } from '@/i18n/LocaleProvider'
import type { ExpenseRow } from '@/lib/data/types'
import { MoneyText } from '@/components/ui/MoneyText'
import { MemberAvatar } from '@/components/ui/MemberAvatar'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--hairline)] py-2.5 last:border-0">
      <span className="shrink-0 text-sm font-semibold text-[var(--muted)]">{label}</span>
      <span className="text-right text-sm font-bold text-[var(--ink)]">{children}</span>
    </div>
  )
}

/** View-only detail sheet for an expense row. Shows all fields untruncated. */
export function ExpenseDetailSheet({ row, onClose }: { row: ExpenseRow; onClose: () => void }) {
  const t = useT()
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/30" onClick={onClose}>
      <div
        className="mx-auto w-full max-w-[430px] rounded-t-2xl bg-[var(--paper)] p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-[var(--ink-head)]">{t('detail.title')}</h2>
          <button type="button" onClick={onClose} className="pressable-opacity text-sm font-bold text-[var(--primary)]">
            {t('common.close')}
          </button>
        </div>
        <div className="flex flex-col">
          <Field label={t('add.date')}>{row.date}</Field>
          {row.details && <Field label={t('detail.note')}>{row.details}</Field>}
          <Field label={t('add.amount')}>
            <MoneyText cents={row.amount_cents} />
          </Field>
          {row.paid_by && (
            <Field label={t('fund.paidBy')}>
              <span className="inline-flex items-center gap-2">
                <MemberAvatar member={row.paid_by} size={24} />
                {row.paid_by}
              </span>
            </Field>
          )}
          {row.category_name && <Field label={t('expenses.category')}>{row.category_name}</Field>}
          {row.vendor_name && <Field label={t('add.vendor')}>{row.vendor_name}</Field>}
          {row.location_name && <Field label={t('add.location')}>{row.location_name}</Field>}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/app/(app)/fund/FundDetailSheet.tsx`**

```tsx
'use client'
import type { ReactNode } from 'react'
import { useT } from '@/i18n/LocaleProvider'
import { monthShort } from '@/lib/data/summary'
import type { FundRecord } from '@/lib/data/fund-shared'
import { MoneyText } from '@/components/ui/MoneyText'
import { MemberAvatar } from '@/components/ui/MemberAvatar'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--hairline)] py-2.5 last:border-0">
      <span className="shrink-0 text-sm font-semibold text-[var(--muted)]">{label}</span>
      <span className="text-right text-sm font-bold text-[var(--ink)]">{children}</span>
    </div>
  )
}

/** View-only detail sheet for a fund contribution row. */
export function FundDetailSheet({
  row,
  locale,
  onClose,
}: {
  row: FundRecord
  locale: 'en' | 'zh'
  onClose: () => void
}) {
  const t = useT()
  const period = `${monthShort(Number(row.periodISO.slice(5, 7)), locale)} ${row.periodISO.slice(0, 4)}`
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/30" onClick={onClose}>
      <div
        className="mx-auto w-full max-w-[430px] rounded-t-2xl bg-[var(--paper)] p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-[var(--ink-head)]">{t('detail.title')}</h2>
          <button type="button" onClick={onClose} className="pressable-opacity text-sm font-bold text-[var(--primary)]">
            {t('common.close')}
          </button>
        </div>
        <div className="flex flex-col">
          <Field label={t('fund.paidBy')}>
            <span className="inline-flex items-center gap-2">
              <MemberAvatar member={row.memberCode} size={24} />
              {row.memberCode}
            </span>
          </Field>
          <Field label={t('fund.period')}>{period}</Field>
          <Field label={t('add.amount')}>
            <MoneyText cents={row.amountCents} />
          </Field>
          {row.notes && <Field label={t('detail.note')}>{row.notes}</Field>}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Add tap detection + detail sheet to `ExpenseRowCard` in `ExpensesView.tsx`**

Add the import:

```tsx
import { ExpenseDetailSheet } from './ExpenseDetailSheet'
```

Add state:

```tsx
  const [detailOpen, setDetailOpen] = useState(false)
```

Extend the drag ref to carry a `moved` flag and rewrite the three pointer handlers (this replaces the existing `onPointerDown` / `onPointerMove` / `onPointerUp`):

```tsx
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
    // A tap (no real drag) on a closed row opens the detail sheet.
    if (!ds.moved && ds.startDragX === 0) {
      setDragX(0)
      setDetailOpen(true)
      return
    }
    setDragX((x) => (x < -REVEAL_WIDTH / 2 ? -REVEAL_WIDTH : 0))
  }
```

Render the detail sheet as a sibling in the fragment (next to the `ConfirmDialog` from Task 2):

```tsx
      {detailOpen && <ExpenseDetailSheet row={row} onClose={() => setDetailOpen(false)} />}
```

- [ ] **Step 4: Add tap detection + detail sheet to `FundRecordCard` in `FundView.tsx`**

Add the import:

```tsx
import { FundDetailSheet } from './FundDetailSheet'
```

Add state:

```tsx
  const [detailOpen, setDetailOpen] = useState(false)
```

Apply the identical `moved`-flag change to the ref and the three pointer handlers:

```tsx
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
    setDragX(Math.min(0, Math.max(-REVEAL_WIDTH, ds.startDragX + delta)))
  }
  function onPointerUp() {
    const ds = dragState.current
    if (!ds) return
    dragState.current = null
    setDragging(false)
    if (!ds.moved && ds.startDragX === 0) {
      setDragX(0)
      setDetailOpen(true)
      return
    }
    setDragX((x) => (x < -REVEAL_WIDTH / 2 ? -REVEAL_WIDTH : 0))
  }
```

Render the detail sheet as a sibling in the fragment (next to the `ConfirmDialog`), passing `locale`:

```tsx
      {detailOpen && <FundDetailSheet row={row} locale={locale} onClose={() => setDetailOpen(false)} />}
```

- [ ] **Step 5: Verify build + lint pass**

Run: `npm run lint && npm run build`
Expected: both succeed with no type errors.

- [ ] **Step 6: Manual check**

Run `npm run dev`. On `/expenses` and `/fund`: a plain tap on a row opens the view-only detail sheet with every field shown untruncated; swiping horizontally still reveals Edit/Delete (and does NOT open the detail sheet); tapping outside the sheet or Close dismisses it. Verify a row with a long note shows the full text in the sheet.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(app)/expenses/ExpenseDetailSheet.tsx" "src/app/(app)/fund/FundDetailSheet.tsx" "src/app/(app)/expenses/ExpensesView.tsx" "src/app/(app)/fund/FundView.tsx"
git commit -m "feat: tap a row to open a view-only detail sheet

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Enhancement 1 (delete confirm dialog) → Task 1 (keys) + Task 2 (`ConfirmDialog` + wiring both lists). ✓
- Enhancement 2 (Manage sheet on Expenses, button right of Filter, remove /manage + /more entry) → Task 3. ✓
- Enhancement 3 (view-only detail sheet, tap-vs-swipe) → Task 1 (keys) + Task 4. ✓
- i18n EN/中文 keys → Task 1, verified by the parity test. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code; every command has an expected result. ✓

**Type consistency:** `ConfirmDialog` prop names (`message`, `confirmLabel`, `cancelLabel`, `onConfirm`, `onCancel`, `busy`) match all call sites in Tasks 2. `ExpenseDetailSheet({ row, onClose })` and `FundDetailSheet({ row, locale, onClose })` match their render sites in Task 4. `dragState` ref shape `{ startX; startDragX; moved }` is consistent across both cards. Reused action signatures (`{ ok: boolean }`) match the existing code. ✓

**Notes:** `Field` is intentionally duplicated in the two detail sheets (≈8 lines) to keep each task self-contained; if desired it can be lifted to `src/components/ui/` later. `row.date` is displayed as the raw `YYYY-MM-DD` ISO string since no full-date locale formatter exists in the repo; introducing one is out of scope.
