# Assets module amendments — FAB, swipe actions, delete, add-txn sheet, opening balance

**Date:** 2026-07-08
**Status:** Approved, ready for planning

## Goal

Bring the Assets module in line with the interaction patterns already used in the
Expenses and Fund modules, and make the property balance math legible.

Five UI changes plus one already-answered investigation:

1. "Add asset" becomes a floating action button (FAB) instead of a header pill.
2. Each asset row on the list supports **swipe-to-reveal Edit + Delete** (edit moves
   off the detail-page header and onto the row).
3. A new `deleteAsset` server action (permanent delete, cascades to transactions and
   commitments).
4. Inside an asset, "Add transaction" becomes a FAB that opens a slide-up bottom
   sheet; "Download CSV" moves to the detail header's top-right.
5. Property detail shows an **Opening balance** line in the transaction list so the
   hero balance reconciles visibly.

Plus (already delivered in chat, no code): the TreeO balance of RM 54,342.03 was
traced to `opening balance 46,013.81 + net transactions 8,328.22`.

## Non-goals

- No change to the per-transaction Edit pencils inside the Property / Investment /
  Vehicle / Generic bodies — those edit individual transactions and stay as-is.
- No change to the existing "close / reopen" (archive) asset flow.
- Opening-balance line is scoped to `PropertyBody` (the TreeO case), not the other
  body types.

## Reference patterns

- FAB: [`src/components/ui/Fab.tsx`](../../../src/components/ui/Fab.tsx)
- Swipe row + confirm delete: [`ExpenseRowCard`](../../../src/app/(app)/expenses/ExpensesView.tsx) (`REVEAL_WIDTH = 152`, pointer drag, `ConfirmDialog`)
- Bottom sheet overlay: [`ExpenseDetailSheet`](../../../src/app/(app)/expenses/ExpenseDetailSheet.tsx) (`fixed inset-0 z-50 flex flex-col justify-end bg-black/30`, inner `rounded-t-2xl`)

## Design

### 1. Assets list — Add asset FAB
File: `src/app/(app)/assets/page.tsx`

- Remove the header `<Link href="/assets/new">` pill; header keeps only the "Assets" title.
- Render `<Fab href="/assets/new" />` once, at the end of the page.
- Change the outer container padding `pb-6` → `pb-28` so the last rows scroll clear of
  the fixed FAB. (`Fab` is `bottom-[100px]`, `h-14`.)
- Empty state already reads "No assets yet — tap ＋ to add one" — no copy change.

### 2. Assets list — swipe-to-reveal Edit + Delete
The current `AssetCard` (a server-rendered `Link`) is replaced by a new **client**
component `AssetRow` mirroring `ExpenseRowCard`:

- New file: `src/app/(app)/assets/AssetRow.tsx` (`'use client'`).
- Props: the `Asset & { key: KeyFigure }` row, `locale`, and an `onDeleteError` callback.
- Pointer-drag mechanics copied from `ExpenseRowCard`: `REVEAL_WIDTH = 152`, clamp
  `dragX` to `[-152, 0]`, snap past half-width, `touch-pan-y`.
- Foreground row keeps the current visuals: `IconTile` (type icon/tint), name + meta
  text, `MoneyText` key figure + label, trailing `ChevronRight`.
- Revealed behind: two equal buttons —
  - **Edit** → `router.push('/assets/${id}/edit')` (background `var(--pending-text)`).
  - **Delete** → opens `ConfirmDialog`; on confirm calls `deleteAsset` (background `var(--danger)`).
- Tap with no real drag → `router.push('/assets/${id}')` (preserves today's behavior).
- `page.tsx` stays a server component: it keeps the group-by-type layout and the
  closed-assets `<details>` section, and renders each entry via `AssetRow`. The
  delete-error banner state lives in a thin client wrapper, or `AssetRow` shows its own
  inline error — match whichever is simplest while keeping `page.tsx` server-side.
  (Expenses keeps the banner in the client `ExpensesView`; assets has no client parent,
  so prefer a per-row inline error to avoid converting the whole page to a client
  component.)

`assetMetaText` and the `TYPE_ICON` / `TYPE_TINT` maps move to (or are imported by)
`AssetRow`; keep them colocated with the row that uses them.

### 3. `deleteAsset` server action
File: `src/app/(app)/assets/actions.ts`

```ts
export async function deleteAsset(input: { id: string }): Promise<{ ok: boolean }>
```

- `getMembership()` guard → `{ ok: false }` if absent.
- `supabase.from('assets').delete().eq('id', input.id).eq('household_id', m.householdId)`.
- FK `on delete cascade` on `asset_transactions.asset_id` and
  `monthly_commitments.asset_id` (verified in `0001_schema.sql` / `0007_commitments_to_asset.sql`)
  removes children automatically — no manual child deletes.
- `revalidatePath('/assets'); revalidatePath('/')`.
- Log and return `{ ok: false }` on error (same shape as `setAssetStatus`).

### 4. Asset detail — Add-txn FAB + bottom sheet, CSV in header
Files: `src/app/(app)/assets/[id]/page.tsx`, `src/app/(app)/assets/[id]/AddTxn.tsx`,
`src/components/ui/Fab.tsx`

**Header** (`page.tsx`):
- Remove the Edit pencil `Link`.
- Replace it with a **Download CSV** icon button in the same top-right slot: lucide
  `Download` inside an `<a href="/report/export?type=asset&id=${id}" download>` styled
  as an icon button (`h-11 w-11 grid place-items-center`, `aria-label={t('asset.exportCsv')}`).
- Remove the full-width CSV `<a>` block at the bottom of the page.
- Container padding → `pb-28` to clear the FAB.

**Fab** (`Fab.tsx`):
- Add an optional `onClick?: () => void`. When provided, render a `<button type="button">`
  with identical styling instead of the `Link` (keep the `href` path for the link case).
  This lets a FAB trigger client state rather than navigation.

**AddTxn** (`AddTxn.tsx`):
- Keep all existing form state/fields/submit logic verbatim.
- Replace the full-width dashed trigger button with a `<Fab onClick={() => setOpen(true)} />`
  (icon-only, bottom-right).
- When `open`, render the form inside a bottom-sheet overlay matching
  `ExpenseDetailSheet`: `fixed inset-0 z-50 flex flex-col justify-end bg-black/30`
  (click backdrop to close), inner panel `mx-auto w-full max-w-[430px] rounded-t-2xl
  bg-[var(--paper)] p-5 pb-8` with `stopPropagation`. The form header/close "×" stays.
- On successful submit, close the sheet (existing `setOpen(false)` + `router.refresh()`).

### 5. Property detail — Opening balance line
File: `src/app/(app)/assets/[id]/PropertyBody.tsx`

- After the transaction list, when `asset.openingBalanceCents` is set and non-zero,
  render one non-interactive row at the **bottom** of the list (transactions are
  newest-first, so the opening balance — the starting point — belongs last).
- Styling: muted / subtle so it does not read as a transaction — e.g. a `Card` (or list
  row) with label `t('asset.openingBalance')` on the left and
  `<MoneyText cents={asset.openingBalanceCents} />` on the right, `text-[var(--muted)]`.
- New i18n key `asset.openingBalance` = "Opening balance" / "期初余额".

### 6. i18n
File: `src/i18n/dictionaries.ts` (EN + ZH blocks)

- `assets.edit` = "Edit" / "编辑"
- `assets.delete` = "Delete" / "删除"
- `assets.confirmDelete` = "Delete this asset? Its transactions and commitments will be removed." / "删除此资产？其交易和承诺项目也会一并删除。"
- `asset.openingBalance` = "Opening balance" / "期初余额"

(`asset.addTxn`, `asset.exportCsv`, `assets.editAsset` already exist.)

## Verification

- `npm run lint` and `npm run build` clean.
- Drive the app:
  - Assets list: FAB bottom-right opens `/assets/new`; swipe a row reveals Edit +
    Delete; Edit routes to edit page; Delete → confirm → row disappears and (for a
    property) its commitments/transactions are gone; tap (no swipe) opens the asset.
  - Asset detail: no Edit pencil in header; Download CSV icon top-right downloads the
    file; add-transaction FAB opens the slide-up sheet; saving adds a txn and closes
    the sheet.
  - TreeO: Opening balance line (RM 46,013.81) shows at the bottom of the list; hero
    balance still RM 54,342.03.

## Risks / notes

- Permanent delete is destructive and irreversible; the `ConfirmDialog` copy must make
  the cascade explicit (see `assets.confirmDelete`).
- Keeping `page.tsx` a server component means the delete-error surface is per-row
  inline rather than a top banner — acceptable and avoids a full client conversion.
