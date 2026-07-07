# Expenses & Fund list enhancements

Date: 2026-07-07
Status: Approved, ready for planning

Three UX enhancements to the Expenses and Fund list screens. No data-layer or
server-action changes — all work is client components, one new UI primitive, and
i18n keys.

## Motivation

- Swipe-to-delete on both lists fires immediately with no confirmation — an
  accidental second tap destroys a record.
- Catalog management (categories / vendors / locations) lives on a separate
  `/manage` page reached via `/more`, two taps away from where it is used.
- Long titles/subtitles on list rows are truncated with an ellipsis; there is no
  way to see the full information for a row.

## Enhancement 1 — Delete confirmation dialog

### Component: `ConfirmDialog`

New reusable primitive at `src/components/ui/ConfirmDialog.tsx` (client
component). A centered modal, not a bottom sheet:

- Full-screen scrim (`fixed inset-0 z-50`, `bg-black/30`), click-outside closes.
- Centered card (`bg-[var(--paper)]`, rounded) containing a message and two
  buttons: **Cancel** (neutral) and a confirm button (`--danger` background,
  white text) whose label is passed in.
- Props: `open`/controlled via conditional render, `title?`, `message`,
  `confirmLabel`, `onConfirm`, `onCancel`, optional `busy` (shows `Spinner` in
  the confirm button and disables both).
- Stops propagation on the card so inner clicks don't dismiss.

This is distinct from the existing `ConfirmButton` (two-tap inline), which stays
for any callers that use it.

### Wiring

In both `ExpensesView.tsx` (`ExpenseRowCard`) and `FundView.tsx`
(`FundRecordCard`):

- Add local state `confirmOpen` to the row card.
- The swipe-revealed **Delete** button now sets `confirmOpen = true` instead of
  calling the delete action directly.
- The dialog's `onConfirm` runs the existing action
  (`deleteExpenseAction` / `deleteFundRecordAction`), keeping the current
  `deleting` spinner and `onDeleteError()` behaviour. Pass `busy={deleting}`.
- `onCancel` closes the dialog and leaves the row untouched (optionally snap the
  row closed).

Out of scope: `ManageSection`'s own `window.confirm` for catalog-item deletion
is left unchanged.

## Enhancement 2 — Manage as a bottom sheet on Expenses

### Header button

In the Expenses header ([ExpensesView.tsx:71-78](../../../src/app/(app)/expenses/ExpensesView.tsx)),
add a compact icon button immediately to the right of the existing Filter
button. Uses the lucide `Tags` icon (distinct from Filter's
`SlidersHorizontal`), with an `aria-label` from i18n. Styling mirrors the Filter
button's pill/round treatment so the two sit together cleanly.

### Component: `ManageSheet`

New client component at `src/app/(app)/expenses/ManageSheet.tsx`, structured like
`FilterSheet`:

- Bottom sheet: `fixed inset-0 z-50 justify-end bg-black/30`, click-outside
  closes; inner panel `max-w-[430px] rounded-t-2xl`, scrollable body
  (`max-h-[70vh] overflow-y-auto`).
- Renders the three existing `ManageSection` blocks (kind `category` / `vendor`
  / `location`) with their titles.
- Props: `categories`, `vendors`, `locations`, `onClose`. The Expenses page
  already loads these three lists for `FilterSheet`, so they are passed straight
  through — no new data fetching.
- `ManageSection` already calls `router.refresh()` after add/rename/delete, which
  re-runs the Expenses server page and refreshes both the catalog lists and the
  expense rows. No extra wiring needed.

### Removals

- Delete the `/manage` route: `src/app/(app)/manage/page.tsx` and
  `src/app/(app)/manage/loading.tsx` if present. Keep
  `src/app/(app)/manage/actions.ts` (server actions still used by
  `ManageSection`) and `src/app/(app)/manage/ManageSection.tsx`.
- Remove the Manage entry from `src/app/(app)/more/page.tsx`, leaving Assets.
- Remove the now-unused `manage.title` / back-navigation usage tied to the page
  (keep the `manage.*` keys used by `ManageSection` and the section titles).

## Enhancement 3 — Row detail bottom sheet (view-only)

### Trigger: tap vs. swipe

Both row cards already use pointer handlers for swipe-to-reveal. Extend them to
detect a tap:

- Track the total horizontal movement during the gesture (e.g. a `moved` flag
  set when `|delta| > 8px` in `onPointerMove`).
- In `onPointerUp`: if the row started closed (`dragX === 0`) and the gesture did
  not exceed the threshold, treat it as a tap → open the detail sheet. Otherwise
  keep the existing snap-to-reveal / snap-closed behaviour.
- A tap on an already-open row keeps its current behaviour (snaps closed).

### Components: `ExpenseDetailSheet` / `FundDetailSheet`

View-only bottom sheets (same shell as `FilterSheet` / `ManageSheet`), each a
labeled list of all fields with no truncation:

- **Expense** (`ExpenseRow`): date, note/details, amount, paid by, category,
  vendor, location. Omit rows whose value is null/empty.
- **Fund** (`FundRecord`): paid by, period (month + year), amount, notes. Omit
  empty notes.

Money is rendered with `MoneyText`; the member with `MemberAvatar`; dates
formatted with the existing locale-aware helpers used elsewhere in the views.
A close button / tap-outside dismisses. No edit or delete affordances in the
sheet (edit/delete remain on the swipe gesture).

These sheets can live beside their views
(`expenses/ExpenseDetailSheet.tsx`, `fund/FundDetailSheet.tsx`), or the shared
bottom-sheet shell can be extracted to `src/components/ui/` if it reduces
duplication across FilterSheet/ManageSheet/detail sheets — decide during
implementation based on how much is genuinely shared.

## i18n

Add EN + 中文 keys, reusing existing keys where they already exist
(`expenses.category`, `add.vendor`, `add.location`, `fund.paidBy`, etc.):

- Delete dialog: title/message and confirm label (may reuse `expenses.delete` /
  `fund.delete` for the button).
- Manage button `aria-label` (e.g. `expenses.manage`).
- Detail sheet: title and any field labels not already covered (date, note,
  amount, period).

## Testing

- Pure logic is minimal here (mostly UI). Where a small pure helper is
  introduced (e.g. formatting the fund period label or assembling the detail
  field list), colocate a `*.test.ts` per the repo convention.
- Manual verification: delete flow shows dialog and cancel/confirm both behave;
  Manage sheet opens from Expenses, edits reflect after refresh; tapping a row
  opens the detail sheet while swipe still reveals actions; both EN and 中文.

## Out of scope

- No changes to server actions, data layer, or DB.
- `ManageSection`'s catalog-item delete confirmation is unchanged.
- No changes to the add/edit forms.
