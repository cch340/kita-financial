# Phase 11 — Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the final roadmap phase — fill `name_zh` for budget categories/commitments end-to-end, replace the two hardcoded Home labels with real computations, add a month stepper to the Budget screen, and clear the accumulated review follow-ups (delete confirmations, asset CSV download, and a batch of a11y/UX nits).

**Architecture:** Follow the established data-layer split — pure, framework-free logic goes in `*-shared.ts` files with colocated vitest tests; Supabase reads/writes stay in server modules; mutations stay in `'use server'` `actions.ts` files that `revalidatePath` then return `{ ok, error? }`. UI stays in the phone-width shell using existing CSS-var tokens, `lucide-react` icons, `min-h-[44px]` tap targets, and the `pressable`/`pressable-opacity` classes. New client interactivity uses `useRouter`/`router.refresh()` exactly like the current screens. The one schema-adjacent artifact is a **data-only** SQL backfill file the user runs by hand in the Supabase SQL editor (no DDL).

**Tech Stack:** Next.js 16 App Router · React 19 · Tailwind 4 · Supabase (Postgres + RLS) · vitest + jsdom · TypeScript. `@/` maps to `src/`.

## Global Constraints

- **Next.js 16 has breaking changes** — read the relevant guide in `node_modules/next/dist/docs/` before writing any Next.js code. `params` and `searchParams` in pages are **Promises** and must be `await`ed (see `expenses/page.tsx`).
- **All money is integer cents** (`number` in TS, `bigint` in Postgres) — never floats. Convert user text with `parseMoneyInput`, display only at the edge with `formatRM`/`MoneyText`.
- **Every DB query is household-scoped** — server functions call `getMembership()` and filter by `m.householdId` so RLS applies. Always use the anon client from `@/lib/supabase/server` (never `admin.ts`) in these paths.
- **Bilingual EN/中文** — every new user-facing string gets a key in **both** `en` and `zh` blocks of `src/i18n/dictionaries.ts`. `t(locale, key)` falls back to `en` then the raw key.
- **No new npm dependencies.**
- **No schema DDL.** The only DB artifact permitted is `supabase/migrations/0004_name_zh_backfill.sql` containing **`UPDATE` statements only**, applied manually in the Supabase SQL editor.
- **Pure logic is unit-tested** — put testable logic in a `*-shared.ts` module and write a colocated `*.test.ts`. Run a single file with `npx vitest run <path>`.
- **Tap targets ≥ 44px**, reuse `var(--...)` tokens and `lucide-react` icons; do not hand-author colors.
- Members are hardcoded `CH` and `JC`. Locale comes from `getMembership().language` on the server and `useLocale()` on the client.

---

## File Structure

**Task 1 — zh names for budget:**
- Modify `src/lib/data/budget-shared.ts` — add `nameZh` to `CategoryRow`/`CommitmentRow`, add pure `localizedName()`.
- Modify `src/lib/data/budget-shared.test.ts` — tests for `localizedName`.
- Modify `src/lib/data/budget.ts` — select/map `name_zh` in the two `*Raw` readers.
- Modify `src/app/(app)/budget/actions.ts` — accept/write `nameZh` on create/update.
- Modify `src/app/(app)/budget/manage/BudgetManager.tsx` — add a 中文 input to both editors and adders.
- Modify `src/app/(app)/budget/page.tsx` — use `localizedName`.
- Modify `src/lib/data/home.ts` — use `localizedName` for commitment titles.
- Modify `src/i18n/dictionaries.ts` — add `budget.nameZhOptional`.
- Create `supabase/migrations/0004_name_zh_backfill.sql` — data-only UPDATEs.

**Task 2 — Home computed labels:**
- Create `src/lib/data/home-shared.ts` — pure `greetingKey()` + `budgetPaceKey()`.
- Create `src/lib/data/home-shared.test.ts`.
- Modify `src/app/(app)/page.tsx` — compute MYT hour/day, use the helpers.
- Modify `src/i18n/dictionaries.ts` — add `home.greeting.afternoon`, `home.greeting.evening`, `home.overPace`.

**Task 3 — Budget month stepper:**
- Create `src/components/ui/MonthStepper.tsx` — reusable client stepper.
- Modify `src/app/(app)/budget/page.tsx` — read `searchParams`, render the stepper.

**Task 4 — Delete confirmations (two-tap):**
- Create `src/components/ui/ConfirmButton.tsx` — arm-then-confirm button.
- Modify `src/app/(app)/personal/PersonalView.tsx` — use it for ledger delete.
- Modify `src/app/(app)/assets/[id]/txn/[txnId]/EditTxnForm.tsx` — use it for txn delete.
- Modify `src/i18n/dictionaries.ts` — add `common.sure`.

**Task 5 — a11y/UX nits:**
- Modify `src/lib/data/csv-shared.ts` — add pure `assetCsvFilename()`.
- Modify `src/lib/data/csv-shared.test.ts` — tests for it.
- Modify `src/app/(app)/report/export/route.ts` — use `assetCsvFilename`.
- Modify `src/app/(app)/assets/[id]/page.tsx` — add CSV download link; use new `assets.closed` label.
- Modify `src/app/(app)/fund/FundView.tsx` — 44px pencil + `aria-expanded`.
- Modify `src/app/(app)/report/MonthBars.tsx` — drop `role="img"`, add a non-color sign cue.
- Modify `src/app/(app)/expenses/ExpensesView.tsx` — reset `dragX` before Edit navigation.
- Modify `src/i18n/dictionaries.ts` — add `assets.closed`, `asset.exportCsv`.

---

## Task 1: 中文 names for budget categories & commitments

Two deliverables in one reviewer gate: (a) the manage form carries `name_zh` going forward, and (b) a one-time SQL backfill for the seeded 7 categories + 8 commitments. The Budget and Home display code already picks zh when present (`locale === 'zh' && x.nameZh ? x.nameZh : x.nameEn`); we DRY that into a tested `localizedName` helper so the intent is explicit and covered.

**Files:**
- Modify: `src/lib/data/budget-shared.ts`
- Test: `src/lib/data/budget-shared.test.ts`
- Modify: `src/lib/data/budget.ts`
- Modify: `src/app/(app)/budget/actions.ts`
- Modify: `src/app/(app)/budget/manage/BudgetManager.tsx`
- Modify: `src/app/(app)/budget/page.tsx`
- Modify: `src/lib/data/home.ts`
- Modify: `src/i18n/dictionaries.ts`
- Create: `supabase/migrations/0004_name_zh_backfill.sql`

**Interfaces:**
- Consumes: `CategoryRow`, `CommitmentRow` (existing, in `budget-shared.ts`); `getBudgetCategoriesRaw()`, `getCommitmentsRaw()` (`budget.ts`); server actions `createCategory`/`updateCategory`/`createCommitment`/`updateCommitment` (`actions.ts`); `Locale` type.
- Produces:
  - `CategoryRow` gains `nameZh: string | null`.
  - `CommitmentRow` gains `nameZh: string | null`.
  - `localizedName(nameEn: string, nameZh: string | null, locale: 'en' | 'zh'): string` in `budget-shared.ts`.
  - `createCategory`/`updateCategory` inputs gain `nameZh: string | null`.
  - `createCommitment`/`updateCommitment` inputs gain `nameZh: string | null`.

- [ ] **Step 1: Write the failing test for `localizedName`**

Append to `src/lib/data/budget-shared.test.ts`:

```typescript
import { moveItem, localizedName } from './budget-shared'

describe('localizedName', () => {
  it('returns the English name for en locale', () => {
    expect(localizedName('House', '房贷', 'en')).toBe('House')
  })
  it('returns the Chinese name for zh locale when present', () => {
    expect(localizedName('House', '房贷', 'zh')).toBe('房贷')
  })
  it('falls back to English when zh name is null', () => {
    expect(localizedName('House', null, 'zh')).toBe('House')
  })
  it('falls back to English when zh name is empty', () => {
    expect(localizedName('House', '', 'zh')).toBe('House')
  })
})
```

Note: the existing file already has `import { moveItem } from './budget-shared'` — replace that import line with the combined one above rather than duplicating it.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/data/budget-shared.test.ts`
Expected: FAIL — `localizedName is not a function` (or an import error).

- [ ] **Step 3: Implement `localizedName` and extend the row types**

In `src/lib/data/budget-shared.ts`, add `nameZh` to both row types and append the helper:

```typescript
export type CategoryRow = {
  id: string
  nameEn: string
  nameZh: string | null
  jcCents: number
  chCents: number
  totalCents: number
  sortOrder: number
}
export type CommitmentRow = {
  id: string
  nameEn: string
  nameZh: string | null
  amountCents: number
  sortOrder: number
}
```

At the end of the file:

```typescript
/** Pick the display name for the given locale, falling back to English when the
 *  Chinese name is missing or blank. Keeps the zh-fallback rule in one tested place. */
export function localizedName(nameEn: string, nameZh: string | null, locale: 'en' | 'zh'): string {
  if (locale === 'zh' && nameZh && nameZh.trim()) return nameZh
  return nameEn
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/data/budget-shared.test.ts`
Expected: PASS (all `moveItem` and `localizedName` cases green).

- [ ] **Step 5: Read `name_zh` in the raw readers**

In `src/lib/data/budget.ts`, update `getBudgetCategoriesRaw` to select and map `name_zh`:

```typescript
export async function getBudgetCategoriesRaw(): Promise<CategoryRow[]> {
  const m = await getMembership()
  if (!m) return []
  const supabase = await createClient()
  const { data, error } = await supabase.from('budget_categories')
    .select('id, name_en, name_zh, jc_cents, ch_cents, total_cents, sort_order')
    .eq('household_id', m.householdId).order('sort_order', { ascending: true })
  if (error) { console.error('getBudgetCategoriesRaw:', error.message); return [] }
  return ((data ?? []) as { id: string; name_en: string; name_zh: string | null; jc_cents: number; ch_cents: number; total_cents: number; sort_order: number }[])
    .map((c) => ({ id: c.id, nameEn: c.name_en, nameZh: c.name_zh, jcCents: c.jc_cents, chCents: c.ch_cents, totalCents: c.total_cents, sortOrder: c.sort_order }))
}
```

And `getCommitmentsRaw`:

```typescript
export async function getCommitmentsRaw(): Promise<CommitmentRow[]> {
  const m = await getMembership()
  if (!m) return []
  const supabase = await createClient()
  const { data, error } = await supabase.from('monthly_commitments')
    .select('id, name_en, name_zh, amount_cents, sort_order')
    .eq('household_id', m.householdId).order('sort_order', { ascending: true })
  if (error) { console.error('getCommitmentsRaw:', error.message); return [] }
  return ((data ?? []) as { id: string; name_en: string; name_zh: string | null; amount_cents: number; sort_order: number }[])
    .map((c) => ({ id: c.id, nameEn: c.name_en, nameZh: c.name_zh, amountCents: c.amount_cents, sortOrder: c.sort_order }))
}
```

- [ ] **Step 6: Accept and write `nameZh` in the four actions**

In `src/app/(app)/budget/actions.ts`, update the four affected functions. `createCategory`:

```typescript
export async function createCategory(input: { nameEn: string; nameZh: string | null; jcCents: number; chCents: number }): Promise<Res> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }
  if (!input.nameEn.trim()) return { ok: false, error: 'invalid_name' }
  const supabase = await createClient()
  const { data: maxRow } = await supabase.from('budget_categories')
    .select('sort_order').eq('household_id', m.householdId).order('sort_order', { ascending: false }).limit(1).maybeSingle()
  const nextOrder = (maxRow?.sort_order ?? 0) + 1
  const { error } = await supabase.from('budget_categories').insert({
    household_id: m.householdId, name_en: input.nameEn.trim(), name_zh: input.nameZh?.trim() || null,
    jc_cents: input.jcCents, ch_cents: input.chCents, total_cents: input.jcCents + input.chCents, sort_order: nextOrder,
  })
  if (error) { console.error('createCategory:', error.message); return { ok: false, error: 'save_failed' } }
  revalidateBudget()
  return { ok: true }
}
```

`updateCategory`:

```typescript
export async function updateCategory(input: { id: string; nameEn: string; nameZh: string | null; jcCents: number; chCents: number }): Promise<Res> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }
  if (!input.nameEn.trim()) return { ok: false, error: 'invalid_name' }
  const supabase = await createClient()
  const { error } = await supabase.from('budget_categories').update({
    name_en: input.nameEn.trim(), name_zh: input.nameZh?.trim() || null,
    jc_cents: input.jcCents, ch_cents: input.chCents, total_cents: input.jcCents + input.chCents,
  }).eq('id', input.id).eq('household_id', m.householdId)
  if (error) { console.error('updateCategory:', error.message); return { ok: false, error: 'save_failed' } }
  revalidateBudget()
  return { ok: true }
}
```

`createCommitment`:

```typescript
export async function createCommitment(input: { nameEn: string; nameZh: string | null; amountCents: number }): Promise<Res> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }
  if (!input.nameEn.trim()) return { ok: false, error: 'invalid_name' }
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) return { ok: false, error: 'invalid_amount' }
  const supabase = await createClient()
  const { data: maxRow } = await supabase.from('monthly_commitments')
    .select('sort_order').eq('household_id', m.householdId).order('sort_order', { ascending: false }).limit(1).maybeSingle()
  const nextOrder = (maxRow?.sort_order ?? 0) + 1
  const { error } = await supabase.from('monthly_commitments').insert({
    household_id: m.householdId, name_en: input.nameEn.trim(), name_zh: input.nameZh?.trim() || null,
    amount_cents: input.amountCents, sort_order: nextOrder,
  })
  if (error) { console.error('createCommitment:', error.message); return { ok: false, error: 'save_failed' } }
  revalidateBudget()
  return { ok: true }
}
```

`updateCommitment`:

```typescript
export async function updateCommitment(input: { id: string; nameEn: string; nameZh: string | null; amountCents: number }): Promise<Res> {
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }
  if (!input.nameEn.trim()) return { ok: false, error: 'invalid_name' }
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) return { ok: false, error: 'invalid_amount' }
  const supabase = await createClient()
  const { error } = await supabase.from('monthly_commitments').update({
    name_en: input.nameEn.trim(), name_zh: input.nameZh?.trim() || null, amount_cents: input.amountCents,
  }).eq('id', input.id).eq('household_id', m.householdId)
  if (error) { console.error('updateCommitment:', error.message); return { ok: false, error: 'save_failed' } }
  revalidateBudget()
  return { ok: true }
}
```

(Leave `deleteCategory`, `reorderCategories`, `deleteCommitment`, `reorderCommitments` unchanged.)

- [ ] **Step 7: Add the 中文 placeholder i18n key**

In `src/i18n/dictionaries.ts`, add to the **en** block near the other `budget.*` keys:

```typescript
    'budget.nameZhOptional': '中文 name (optional)',
```

And to the **zh** block near its `budget.*` keys:

```typescript
    'budget.nameZhOptional': '中文名称（选填）',
```

- [ ] **Step 8: Add a 中文 input to the manage editors and adders**

In `src/app/(app)/budget/manage/BudgetManager.tsx`, thread `nameZh` through all four `on*` callbacks and add the input.

First, the top-level wiring — update the four callbacks:

```typescript
          <CategoryEditor
            key={c.id}
            row={c}
            disabled={busy}
            canUp={i > 0}
            canDown={i < categories.length - 1}
            onSave={(nameEn, nameZh, jcCents, chCents) => run(() => updateCategory({ id: c.id, nameEn, nameZh, jcCents, chCents }))}
            onDelete={() => run(() => deleteCategory(c.id))}
            onMove={(delta) => run(() => reorderCategories(moveItem(categories, i, delta).map((x) => x.id)))}
          />
```

```typescript
        <CategoryAdder disabled={busy} onAdd={(nameEn, nameZh, jcCents, chCents) => run(() => createCategory({ nameEn, nameZh, jcCents, chCents }))} />
```

```typescript
          <CommitmentEditor
            key={c.id}
            row={c}
            disabled={busy}
            canUp={i > 0}
            canDown={i < commitments.length - 1}
            onSave={(nameEn, nameZh, amountCents) => run(() => updateCommitment({ id: c.id, nameEn, nameZh, amountCents }))}
            onDelete={() => run(() => deleteCommitment(c.id))}
            onMove={(delta) => run(() => reorderCommitments(moveItem(commitments, i, delta).map((x) => x.id)))}
          />
```

```typescript
        <CommitmentAdder disabled={busy} onAdd={(nameEn, nameZh, amountCents) => run(() => createCommitment({ nameEn, nameZh, amountCents }))} />
```

Then update `CategoryEditor` — signature, a `zh` state, the input, and the save call:

```typescript
function CategoryEditor({ row, disabled, canUp, canDown, onSave, onDelete, onMove }: {
  row: CategoryRow; disabled: boolean; canUp: boolean; canDown: boolean
  onSave: (nameEn: string, nameZh: string | null, jcCents: number, chCents: number) => void
  onDelete: () => void; onMove: (delta: -1 | 1) => void
}) {
  const t = useT()
  const [name, setName] = useState(row.nameEn)
  const [nameZh, setNameZh] = useState(row.nameZh ?? '')
  const [jc, setJc] = useState((row.jcCents / 100).toFixed(2))
  const [ch, setCh] = useState((row.chCents / 100).toFixed(2))
  return (
    <Card className="flex items-start gap-2">
      <MoveButtons canUp={canUp} canDown={canDown} disabled={disabled} onMove={onMove} />
      <div className="flex flex-1 flex-col gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--ink)] outline-none" />
        <input value={nameZh} onChange={(e) => setNameZh(e.target.value)} placeholder={t('budget.nameZhOptional')}
          className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--faint)]" />
        <div className="flex gap-2">
          <MoneyMini label="JC" value={jc} onChange={setJc} />
          <MoneyMini label="CH" value={ch} onChange={setCh} />
        </div>
        <div className="flex gap-2">
          <button type="button" disabled={disabled} onClick={() => onSave(name, nameZh.trim() || null, parseMoneyInput(jc), parseMoneyInput(ch))}
            className="pressable min-h-[40px] flex-1 rounded-lg bg-[var(--primary-btn)] text-sm font-bold text-white disabled:opacity-40">
            {t('personal.save')}
          </button>
          <button type="button" disabled={disabled} onClick={onDelete} aria-label={t('personal.delete')}
            className="pressable grid min-h-[40px] w-11 place-items-center rounded-lg border border-[var(--hairline)] text-[var(--danger)] disabled:opacity-40">
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </Card>
  )
}
```

Update `CategoryAdder` — add `nameZh` state, input, reset, and pass it in `onAdd`:

```typescript
function CategoryAdder({ disabled, onAdd }: { disabled: boolean; onAdd: (nameEn: string, nameZh: string | null, jcCents: number, chCents: number) => void }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [nameZh, setNameZh] = useState('')
  const [jc, setJc] = useState('')
  const [ch, setCh] = useState('')
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="pressable flex min-h-[44px] w-full items-center justify-center gap-1 rounded-xl border border-dashed border-[var(--primary)] py-3 text-sm font-bold text-[var(--primary)]">
        <Plus size={16} /> {t('budget.addCategory')}
      </button>
    )
  }
  return (
    <Card className="flex flex-col gap-2">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('budget.categoryName')}
        className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--faint)]" />
      <input value={nameZh} onChange={(e) => setNameZh(e.target.value)} placeholder={t('budget.nameZhOptional')}
        className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--faint)]" />
      <div className="flex gap-2">
        <MoneyMini label="JC" value={jc} onChange={setJc} />
        <MoneyMini label="CH" value={ch} onChange={setCh} />
      </div>
      <div className="flex gap-2">
        <button type="button" disabled={disabled || !name.trim()}
          onClick={() => { onAdd(name, nameZh.trim() || null, parseMoneyInput(jc), parseMoneyInput(ch)); setOpen(false); setName(''); setNameZh(''); setJc(''); setCh('') }}
          className="pressable min-h-[40px] flex-1 rounded-lg bg-[var(--primary-btn)] text-sm font-bold text-white disabled:opacity-40">
          {t('budget.add')}
        </button>
        <button type="button" onClick={() => setOpen(false)} aria-label={t('common.close')}
          className="pressable-opacity grid h-10 w-10 place-items-center text-xl text-[var(--muted)]">×</button>
      </div>
    </Card>
  )
}
```

Update `CommitmentEditor` — add the zh input under the English name input:

```typescript
function CommitmentEditor({ row, disabled, canUp, canDown, onSave, onDelete, onMove }: {
  row: CommitmentRow; disabled: boolean; canUp: boolean; canDown: boolean
  onSave: (nameEn: string, nameZh: string | null, amountCents: number) => void
  onDelete: () => void; onMove: (delta: -1 | 1) => void
}) {
  const t = useT()
  const [name, setName] = useState(row.nameEn)
  const [nameZh, setNameZh] = useState(row.nameZh ?? '')
  const [amount, setAmount] = useState((row.amountCents / 100).toFixed(2))
  return (
    <Card className="flex items-start gap-2">
      <MoveButtons canUp={canUp} canDown={canDown} disabled={disabled} onMove={onMove} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--ink)] outline-none" />
        <input value={nameZh} onChange={(e) => setNameZh(e.target.value)} placeholder={t('budget.nameZhOptional')}
          className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--faint)]" />
        <div className="flex items-center gap-2">
          <div className="flex w-24 shrink-0 items-center gap-1 rounded-lg border border-[var(--hairline)] bg-[var(--surface)] px-2 py-2">
            <span className="text-xs text-[var(--muted)]">RM</span>
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-transparent text-sm text-[var(--ink)] outline-none" />
          </div>
          <button type="button" disabled={disabled} onClick={() => onSave(name, nameZh.trim() || null, parseMoneyInput(amount))}
            className="pressable min-h-[40px] flex-1 rounded-lg bg-[var(--primary-btn)] px-3 text-sm font-bold text-white disabled:opacity-40">
            {t('personal.save')}
          </button>
          <button type="button" disabled={disabled} onClick={onDelete} aria-label={t('personal.delete')}
            className="pressable grid min-h-[40px] w-10 shrink-0 place-items-center rounded-lg border border-[var(--hairline)] text-[var(--danger)] disabled:opacity-40">
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </Card>
  )
}
```

(The layout changes from a single row to a stacked column because the zh input needs its own line; the money field + save + delete stay on one row.)

Update `CommitmentAdder`:

```typescript
function CommitmentAdder({ disabled, onAdd }: { disabled: boolean; onAdd: (nameEn: string, nameZh: string | null, amountCents: number) => void }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [nameZh, setNameZh] = useState('')
  const [amount, setAmount] = useState('')
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="pressable flex min-h-[44px] w-full items-center justify-center gap-1 rounded-xl border border-dashed border-[var(--primary)] py-3 text-sm font-bold text-[var(--primary)]">
        <Plus size={16} /> {t('budget.addCommitment')}
      </button>
    )
  }
  return (
    <Card className="flex flex-col gap-2">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('budget.commitmentName')}
        className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--faint)]" />
      <input value={nameZh} onChange={(e) => setNameZh(e.target.value)} placeholder={t('budget.nameZhOptional')}
        className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--faint)]" />
      <div className="flex items-center gap-2 rounded-lg border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2">
        <span className="text-xs text-[var(--muted)]">RM</span>
        <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
          className="flex-1 bg-transparent text-sm text-[var(--ink)] outline-none" />
      </div>
      <div className="flex gap-2">
        <button type="button" disabled={disabled || !name.trim()}
          onClick={() => { onAdd(name, nameZh.trim() || null, parseMoneyInput(amount)); setOpen(false); setName(''); setNameZh(''); setAmount('') }}
          className="pressable min-h-[40px] flex-1 rounded-lg bg-[var(--primary-btn)] text-sm font-bold text-white disabled:opacity-40">
          {t('budget.add')}
        </button>
        <button type="button" onClick={() => setOpen(false)} aria-label={t('common.close')}
          className="pressable-opacity grid h-10 w-10 place-items-center text-xl text-[var(--muted)]">×</button>
      </div>
    </Card>
  )
}
```

- [ ] **Step 9: Use `localizedName` in the Budget page and Home**

In `src/app/(app)/budget/page.tsx`, add the import and replace the two inline name expressions:

```typescript
import { getBudget } from '@/lib/data/budget'
import { localizedName } from '@/lib/data/budget-shared'
```

Category line (inside the `categories.map`), replace:

```typescript
        const name = locale === 'zh' && cat.nameZh ? cat.nameZh : cat.nameEn
```

with:

```typescript
        const name = localizedName(cat.nameEn, cat.nameZh, locale)
```

Commitment line (inside the `commitments.map`), replace:

```typescript
          const name = locale === 'zh' && c.nameZh ? c.nameZh : c.nameEn
```

with:

```typescript
          const name = localizedName(c.nameEn, c.nameZh, locale)
```

In `src/lib/data/home.ts`, add the import and use the helper for commitment titles. Add near the top imports:

```typescript
import { localizedName } from './budget-shared'
```

Replace the `commitmentItems` mapping title:

```typescript
  const commitmentItems: UpcomingItem[] = commitmentRows.map((r) => ({
    icon: 'Zap',
    title: localizedName(r.name_en, r.name_zh, locale),
    due: t(locale, 'home.due'),
    amountCents: r.amount_cents,
    status: 'upcoming',
  }))
```

- [ ] **Step 10: Write the backfill SQL**

Create `supabase/migrations/0004_name_zh_backfill.sql`. Data-only; scoped to the seed household id and matched on `name_en` so it is safe to re-run (idempotent UPDATEs):

```sql
-- 0004_name_zh_backfill.sql
-- One-time data backfill: populate name_zh for the seeded budget categories and
-- monthly commitments. Run manually in the Supabase SQL editor (see SETUP.md).
-- No DDL. Idempotent: re-running only overwrites name_zh with the same values.
-- Scoped to the seed household. If your household id differs, adjust the WHERE.

begin;

-- Budget categories (7)
update budget_categories set name_zh = '房贷 + 水电' where household_id = '00000000-0000-0000-0000-0000000000aa' and name_en = 'House';
update budget_categories set name_zh = '伙食'         where household_id = '00000000-0000-0000-0000-0000000000aa' and name_en = 'Food';
update budget_categories set name_zh = '应急基金'      where household_id = '00000000-0000-0000-0000-0000000000aa' and name_en = 'Emergency fund';
update budget_categories set name_zh = 'Leo 保险'      where household_id = '00000000-0000-0000-0000-0000000000aa' and name_en = 'Leo insurance';
update budget_categories set name_zh = 'Leo 伙食 + 尿布' where household_id = '00000000-0000-0000-0000-0000000000aa' and name_en = 'Leo Food + diapers';
update budget_categories set name_zh = 'Leo 衣物'      where household_id = '00000000-0000-0000-0000-0000000000aa' and name_en = 'Leo Clothes';
update budget_categories set name_zh = 'Leo 医疗备用金' where household_id = '00000000-0000-0000-0000-0000000000aa' and name_en = 'Leo fund in case sick';

-- Monthly commitments (8)
update monthly_commitments set name_zh = '房贷分期'    where household_id = '00000000-0000-0000-0000-0000000000aa' and name_en = 'House installment';
update monthly_commitments set name_zh = '房屋维护费'  where household_id = '00000000-0000-0000-0000-0000000000aa' and name_en = 'House maintenance';
update monthly_commitments set name_zh = 'LG 净水器'   where household_id = '00000000-0000-0000-0000-0000000000aa' and name_en = 'LG water purifier';
update monthly_commitments set name_zh = 'LG 空气净化器' where household_id = '00000000-0000-0000-0000-0000000000aa' and name_en = 'LG air purifier';
update monthly_commitments set name_zh = '户外滤水器'  where household_id = '00000000-0000-0000-0000-0000000000aa' and name_en = 'Outdoor water filter';
update monthly_commitments set name_zh = 'Time 光纤网络' where household_id = '00000000-0000-0000-0000-0000000000aa' and name_en = 'Time Fibre Internet';
update monthly_commitments set name_zh = '电费'        where household_id = '00000000-0000-0000-0000-0000000000aa' and name_en = 'Electric Bill';
update monthly_commitments set name_zh = '水费'        where household_id = '00000000-0000-0000-0000-0000000000aa' and name_en = 'Water Bill';

commit;
```

- [ ] **Step 11: Verify the full build and existing tests still pass**

Run: `npm run lint && npx vitest run src/lib/data/budget-shared.test.ts`
Expected: lint clean; tests PASS.

- [ ] **Step 12: Commit**

```bash
git add src/lib/data/budget-shared.ts src/lib/data/budget-shared.test.ts src/lib/data/budget.ts src/app/\(app\)/budget/actions.ts "src/app/(app)/budget/manage/BudgetManager.tsx" "src/app/(app)/budget/page.tsx" src/lib/data/home.ts src/i18n/dictionaries.ts supabase/migrations/0004_name_zh_backfill.sql
git commit -m "feat(budget): 中文 names for categories & commitments + backfill SQL"
```

---

## Task 2: Computed Home labels (greeting + budget pace)

Replace the hardcoded `home.greeting.morning` and the hardcoded `home.onTrack` on Home with real computations, driven by pure, tested helpers.

**Timezone decision (justify):** The household is in Malaysia (MYT = UTC+8, no DST). On Vercel `new Date()` is UTC, so a naive `getHours()` would be wrong. We compute the MYT wall-clock hour and day-of-month **on the server** by shifting the UTC instant by +8h — deterministic, no client component, no hydration risk, and the page stays a Server Component. The shift is done in `page.tsx`; the branching logic lives in pure helpers that take plain numbers, so they are fully unit-testable without touching `Date`.

**Files:**
- Create: `src/lib/data/home-shared.ts`
- Test: `src/lib/data/home-shared.test.ts`
- Modify: `src/app/(app)/page.tsx`
- Modify: `src/i18n/dictionaries.ts`

**Interfaces:**
- Consumes: `home.greeting.morning` (existing key).
- Produces:
  - `greetingKey(hour24: number): 'home.greeting.morning' | 'home.greeting.afternoon' | 'home.greeting.evening'`
  - `budgetPaceKey(spentCents: number, totalCents: number, dayOfMonth: number, daysInMonth: number): 'home.onTrack' | 'home.overPace'`
  - New i18n keys `home.greeting.afternoon`, `home.greeting.evening`, `home.overPace`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/data/home-shared.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { greetingKey, budgetPaceKey } from './home-shared'

describe('greetingKey', () => {
  it('is morning from 05:00 to 11:59', () => {
    expect(greetingKey(5)).toBe('home.greeting.morning')
    expect(greetingKey(11)).toBe('home.greeting.morning')
  })
  it('is afternoon from 12:00 to 17:59', () => {
    expect(greetingKey(12)).toBe('home.greeting.afternoon')
    expect(greetingKey(17)).toBe('home.greeting.afternoon')
  })
  it('is evening from 18:00 to 04:59', () => {
    expect(greetingKey(18)).toBe('home.greeting.evening')
    expect(greetingKey(23)).toBe('home.greeting.evening')
    expect(greetingKey(0)).toBe('home.greeting.evening')
    expect(greetingKey(4)).toBe('home.greeting.evening')
  })
})

describe('budgetPaceKey', () => {
  it('is on track when spend is below the pro-rated allowance', () => {
    // Day 15 of 30 → half the month → allowance = 50% of 1000 = 500. Spent 400 < 500.
    expect(budgetPaceKey(40000, 100000, 15, 30)).toBe('home.onTrack')
  })
  it('is over pace when spend exceeds the pro-rated allowance', () => {
    // Day 10 of 30 → allowance = 1/3 of 1000 ≈ 333. Spent 500 > 333.
    expect(budgetPaceKey(50000, 100000, 10, 30)).toBe('home.overPace')
  })
  it('is on track exactly at the allowance boundary', () => {
    expect(budgetPaceKey(50000, 100000, 15, 30)).toBe('home.onTrack')
  })
  it('treats a zero budget as on track (nothing to overspend)', () => {
    expect(budgetPaceKey(0, 0, 15, 30)).toBe('home.onTrack')
  })
  it('is over pace on the last day when spend exceeds the full budget', () => {
    expect(budgetPaceKey(110000, 100000, 30, 30)).toBe('home.overPace')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/data/home-shared.test.ts`
Expected: FAIL — module `./home-shared` not found.

- [ ] **Step 3: Implement the helpers**

Create `src/lib/data/home-shared.ts`:

```typescript
// Pure, server/client-safe Home-label helpers — no supabase / next/headers here.

/** Time-of-day greeting key. Morning 05–11, afternoon 12–17, evening 18–04.
 *  `hour24` is a 0–23 wall-clock hour (computed in the user's timezone by the caller). */
export function greetingKey(
  hour24: number,
): 'home.greeting.morning' | 'home.greeting.afternoon' | 'home.greeting.evening' {
  if (hour24 >= 5 && hour24 < 12) return 'home.greeting.morning'
  if (hour24 >= 12 && hour24 < 18) return 'home.greeting.afternoon'
  return 'home.greeting.evening'
}

/** Compares month-to-date spend against a pro-rated (by day-of-month) share of the
 *  total budget. On or under the allowance → on track; strictly over → over pace.
 *  A zero/empty budget is treated as on track. */
export function budgetPaceKey(
  spentCents: number,
  totalCents: number,
  dayOfMonth: number,
  daysInMonth: number,
): 'home.onTrack' | 'home.overPace' {
  if (totalCents <= 0 || daysInMonth <= 0) return 'home.onTrack'
  const allowanceCents = (totalCents * dayOfMonth) / daysInMonth
  return spentCents > allowanceCents ? 'home.overPace' : 'home.onTrack'
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/data/home-shared.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the i18n keys**

In `src/i18n/dictionaries.ts`, add to the **en** block (near the existing `home.*` keys):

```typescript
    'home.greeting.afternoon': 'Good afternoon',
    'home.greeting.evening': 'Good evening',
    'home.overPace': 'Over pace',
```

And to the **zh** block:

```typescript
    'home.greeting.afternoon': '午安',
    'home.greeting.evening': '晚安',
    'home.overPace': '超出进度',
```

- [ ] **Step 6: Wire the helpers into the Home page**

In `src/app/(app)/page.tsx`, add the import:

```typescript
import { greetingKey, budgetPaceKey } from '@/lib/data/home-shared'
```

Just after the existing `budgetLeftCents` computation, add the MYT-shifted time values and the two label keys:

```typescript
  // MYT wall-clock (UTC+8, no DST). Server runs UTC on Vercel, so shift the instant
  // by +8h and read UTC fields to get Malaysia local hour / day-of-month.
  const myt = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  const mytHour = myt.getUTCHours()
  const mytDay = myt.getUTCDate()
  const daysInMonth = new Date(Date.UTC(myt.getUTCFullYear(), myt.getUTCMonth() + 1, 0)).getUTCDate()
  const greeting = t(locale, greetingKey(mytHour))
  const paceKey = budgetPaceKey(summary.budget.spentCents, summary.budget.totalCents, mytDay, daysInMonth)
```

Replace the hardcoded greeting header line:

```typescript
          <h1 className="text-xl font-extrabold text-[var(--ink-head)]">
            {t(locale, 'home.greeting.morning')}, {displayName}
          </h1>
```

with:

```typescript
          <h1 className="text-xl font-extrabold text-[var(--ink-head)]">
            {greeting}, {displayName}
          </h1>
```

Replace the hardcoded budget-card status line:

```typescript
          <span className="text-xs font-semibold text-[var(--positive-text)]">{t(locale, 'home.onTrack')}</span>
```

with (color follows the computed state — green on track, amber/pending over pace, a non-hardcoded token):

```typescript
          <span
            className="text-xs font-semibold"
            style={{ color: paceKey === 'home.overPace' ? 'var(--pending-text)' : 'var(--positive-text)' }}
          >
            {t(locale, paceKey)}
          </span>
```

- [ ] **Step 7: Verify build and tests**

Run: `npm run lint && npx vitest run src/lib/data/home-shared.test.ts`
Expected: lint clean; tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/data/home-shared.ts src/lib/data/home-shared.test.ts "src/app/(app)/page.tsx" src/i18n/dictionaries.ts
git commit -m "feat(home): compute greeting and budget-pace labels (MYT)"
```

---

## Task 3: Budget month stepper

Anchor the Budget screen to a `?y=&m=` month like the Expenses screen instead of always the current month. `getBudget(year, month)` already accepts a month range, so only the page wiring and a client stepper are needed. We extract a small reusable `MonthStepper` client component (the prev/next control needs `useRouter`, which a Server Component cannot use) and mount it on Budget.

**Files:**
- Create: `src/components/ui/MonthStepper.tsx`
- Modify: `src/app/(app)/budget/page.tsx`

**Interfaces:**
- Consumes: `formatMonthYear` (`@/lib/data/summary`), `useT`/`useLocale` (`@/i18n/LocaleProvider`), existing i18n keys `expenses.prevMonth`, `expenses.nextMonth`.
- Produces: `MonthStepper({ year, month, basePath }: { year: number; month: number; basePath: string })` — a client component that pushes `${basePath}?y=<y>&m=<m>` on prev/next.

- [ ] **Step 1: Create the reusable stepper component**

Create `src/components/ui/MonthStepper.tsx` (mirrors the inline stepper markup already in `ExpensesView`/`PersonalView` so it looks identical):

```tsx
'use client'
import { useRouter } from 'next/navigation'
import { useT, useLocale } from '@/i18n/LocaleProvider'
import { formatMonthYear } from '@/lib/data/summary'

/** Prev / label / next month control. Pushes `${basePath}?y=<year>&m=<month>`.
 *  Matches the inline steppers on Expenses and Personal for visual consistency. */
export function MonthStepper({ year, month, basePath }: { year: number; month: number; basePath: string }) {
  const t = useT()
  const locale = useLocale()
  const router = useRouter()

  function goMonth(delta: number) {
    let m = month + delta
    let y = year
    if (m < 1) {
      m = 12
      y -= 1
    } else if (m > 12) {
      m = 1
      y += 1
    }
    router.push(`${basePath}?y=${y}&m=${m}`)
  }

  return (
    <div className="flex items-center justify-center gap-4">
      <button
        type="button"
        aria-label={t('expenses.prevMonth')}
        onClick={() => goMonth(-1)}
        className="pressable-opacity grid h-11 w-11 place-items-center rounded-full text-xl text-[var(--muted)]"
      >
        ‹
      </button>
      <span className="min-w-[150px] text-center text-sm font-bold text-[var(--ink-head)]">
        {formatMonthYear(year, month, locale)}
      </span>
      <button
        type="button"
        aria-label={t('expenses.nextMonth')}
        onClick={() => goMonth(1)}
        className="pressable-opacity grid h-11 w-11 place-items-center rounded-full text-xl text-[var(--muted)]"
      >
        ›
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Wire `searchParams` and the stepper into the Budget page**

In `src/app/(app)/budget/page.tsx`, change the component signature to read `searchParams` (a Promise in Next 16) and clamp like `expenses/page.tsx` does. Replace the top of the file through the `monthLabel` line:

```tsx
import Link from 'next/link'
import { getBudget } from '@/lib/data/budget'
import { localizedName } from '@/lib/data/budget-shared'
import { getMembership } from '@/lib/data/household'
import { t } from '@/i18n'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { MoneyText } from '@/components/ui/MoneyText'
import { MonthStepper } from '@/components/ui/MonthStepper'
import { SplitBar, ActualBar } from './BudgetBars'

export default async function BudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string }>
}) {
  const { y, m } = await searchParams
  const now = new Date()
  const parsedYear = Number(y)
  const parsedMonth = Number(m)
  const year = Number.isInteger(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100 ? parsedYear : now.getFullYear()
  const month = Number.isInteger(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12 ? parsedMonth : now.getMonth() + 1

  const [budget, membership] = await Promise.all([getBudget(year, month), getMembership()])
  const locale = membership?.language ?? 'en'
```

(Note: `formatMonthYear` is no longer used directly in this file — the stepper renders the label — so remove its import if present. `localizedName` was already imported in Task 1.)

Then replace the header block + delete the standalone month chip, and add the stepper below the header. Replace:

```tsx
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-[var(--ink-head)]">{t(locale, 'budget.title')}</h1>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[var(--subtle)] px-3 py-1 text-xs font-bold text-[var(--muted)]">
            {monthLabel}
          </span>
          <Link
            href="/budget/manage"
            className="pressable rounded-full bg-[var(--primary-btn)] px-3 py-1 text-xs font-bold text-white"
          >
            {t(locale, 'budget.manage')}
          </Link>
        </div>
      </header>
```

with:

```tsx
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-[var(--ink-head)]">{t(locale, 'budget.title')}</h1>
        <Link
          href="/budget/manage"
          className="pressable rounded-full bg-[var(--primary-btn)] px-3 py-1 text-xs font-bold text-white"
        >
          {t(locale, 'budget.manage')}
        </Link>
      </header>

      <MonthStepper year={year} month={month} basePath="/budget" />
```

(The `const monthLabel = formatMonthYear(...)` line is now unused — delete it.)

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, open `/budget`, tap ‹ / › and confirm the URL becomes `/budget?y=YYYY&m=M`, the label and per-category actual-spend bars update for the selected month, and the current month renders when visiting `/budget` with no params.
Expected: stepper navigates and data reloads per month.

Also run: `npm run lint`
Expected: clean (no unused-import errors).

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/MonthStepper.tsx "src/app/(app)/budget/page.tsx"
git commit -m "feat(budget): month stepper anchored to ?y=&m="
```

---

## Task 4: Delete confirmations (two-tap) for ledger entries & asset transactions

Add a lightweight arm-then-confirm pattern (no modal library): the delete button flips to a "Sure?" state on first tap and performs the delete on the second, auto-disarming after a few seconds. Reused via a small `ConfirmButton` component so both call sites behave identically.

**Files:**
- Create: `src/components/ui/ConfirmButton.tsx`
- Modify: `src/app/(app)/personal/PersonalView.tsx`
- Modify: `src/app/(app)/assets/[id]/txn/[txnId]/EditTxnForm.tsx`
- Modify: `src/i18n/dictionaries.ts`

**Interfaces:**
- Consumes: `useT` (`@/i18n/LocaleProvider`).
- Produces: `ConfirmButton({ onConfirm, label, confirmLabel, disabled, className }: { onConfirm: () => void; label: string; confirmLabel: string; disabled?: boolean; className?: string })` — renders `label`; first click arms and swaps to `confirmLabel`; second click (while armed) calls `onConfirm`; auto-disarms after 3s.

- [ ] **Step 1: Create the ConfirmButton component**

Create `src/components/ui/ConfirmButton.tsx`:

```tsx
'use client'
import { useEffect, useState } from 'react'

/** Two-tap delete confirm, no modal. First tap arms (shows `confirmLabel`);
 *  second tap within 3s calls `onConfirm`. Auto-disarms after the timeout. */
export function ConfirmButton({
  onConfirm,
  label,
  confirmLabel,
  disabled,
  className,
}: {
  onConfirm: () => void
  label: string
  confirmLabel: string
  disabled?: boolean
  className?: string
}) {
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (!armed) return
    const id = setTimeout(() => setArmed(false), 3000)
    return () => clearTimeout(id)
  }, [armed])

  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={armed}
      onClick={() => {
        if (armed) {
          setArmed(false)
          onConfirm()
        } else {
          setArmed(true)
        }
      }}
      className={className}
    >
      {armed ? confirmLabel : label}
    </button>
  )
}
```

- [ ] **Step 2: Add the `common.sure` i18n key**

In `src/i18n/dictionaries.ts`, add to the **en** block near `common.close`:

```typescript
    'common.sure': 'Sure?',
```

And to the **zh** block near its `common.close`:

```typescript
    'common.sure': '确定？',
```

- [ ] **Step 3: Use ConfirmButton for the personal ledger delete**

In `src/app/(app)/personal/PersonalView.tsx`, add the import:

```typescript
import { ConfirmButton } from '@/components/ui/ConfirmButton'
```

In `LedgerRow`, replace the plain delete button:

```tsx
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className="pressable min-h-[44px] rounded-lg border border-[var(--hairline)] px-3 py-2 text-sm font-bold text-[var(--danger)] disabled:opacity-40"
        >
          {t('personal.delete')}
        </button>
```

with:

```tsx
        <ConfirmButton
          onConfirm={remove}
          label={t('personal.delete')}
          confirmLabel={t('common.sure')}
          disabled={busy}
          className="pressable min-h-[44px] rounded-lg border border-[var(--hairline)] px-3 py-2 text-sm font-bold text-[var(--danger)] disabled:opacity-40"
        />
```

- [ ] **Step 4: Use ConfirmButton for the asset transaction delete**

In `src/app/(app)/assets/[id]/txn/[txnId]/EditTxnForm.tsx`, add the import:

```typescript
import { ConfirmButton } from '@/components/ui/ConfirmButton'
```

Replace the delete button near the end of the form:

```tsx
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="pressable min-h-[44px] w-full rounded-xl border border-[var(--hairline)] py-3 text-sm font-bold text-[var(--danger)] disabled:opacity-40"
          >
            {t('asset.deleteTxn')}
          </button>
```

with:

```tsx
          <ConfirmButton
            onConfirm={remove}
            label={t('asset.deleteTxn')}
            confirmLabel={t('common.sure')}
            disabled={busy}
            className="pressable min-h-[44px] w-full rounded-xl border border-[var(--hairline)] py-3 text-sm font-bold text-[var(--danger)] disabled:opacity-40"
          />
```

- [ ] **Step 5: Manual verification**

Run: `npm run dev`. On `/personal`, expand a ledger entry, tap Delete → it reads "Sure?"; tap again → deletes; arm once and wait ~3s → it reverts to "Delete". Repeat on an asset transaction edit screen (`/assets/<id>/txn/<txnId>`).
Also run: `npm run lint`
Expected: clean; two-tap works on both screens.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/ConfirmButton.tsx "src/app/(app)/personal/PersonalView.tsx" "src/app/(app)/assets/[id]/txn/[txnId]/EditTxnForm.tsx" src/i18n/dictionaries.ts
git commit -m "feat: two-tap delete confirm for ledger entries & asset txns"
```

---

## Task 5: a11y & UX nits

A batch of independent small fixes. Grouped into one reviewer gate because each is a few lines and they share the theme of accessibility/UX polish. The one piece of pure logic (the CSV filename fallback) is TDD-anchored; the rest are markup/attribute changes verified by eye.

**Files:**
- Modify: `src/lib/data/csv-shared.ts`
- Test: `src/lib/data/csv-shared.test.ts`
- Modify: `src/app/(app)/report/export/route.ts`
- Modify: `src/app/(app)/assets/[id]/page.tsx`
- Modify: `src/app/(app)/fund/FundView.tsx`
- Modify: `src/app/(app)/report/MonthBars.tsx`
- Modify: `src/app/(app)/expenses/ExpensesView.tsx`
- Modify: `src/i18n/dictionaries.ts`

**Interfaces:**
- Produces: `assetCsvFilename(name: string, id: string): string` in `csv-shared.ts` — returns `kita-asset-<slug>.csv`, falling back to the id when the slug is empty (all-CJK names). New i18n keys `assets.closed`, `asset.exportCsv`.

### 5a — Asset CSV download + filename slug fix

- [ ] **Step 1: Write the failing test for `assetCsvFilename`**

Append to `src/lib/data/csv-shared.test.ts`:

```typescript
import { assetCsvFilename } from './csv-shared'

describe('assetCsvFilename', () => {
  it('slugifies an ASCII asset name', () => {
    expect(assetCsvFilename('TreeO Condo', 'abc-123')).toBe('kita-asset-treeo-condo.csv')
  })
  it('falls back to the id when the name is all non-ASCII (all-CJK)', () => {
    expect(assetCsvFilename('房产', 'abc-123')).toBe('kita-asset-abc-123.csv')
  })
  it('falls back to the id when the name is empty', () => {
    expect(assetCsvFilename('', 'abc-123')).toBe('kita-asset-abc-123.csv')
  })
  it('trims leading/trailing separators from the slug', () => {
    expect(assetCsvFilename('  Myvi!!  ', 'x')).toBe('kita-asset-myvi.csv')
  })
})
```

(If `csv-shared.test.ts` already imports from `./csv-shared`, add `assetCsvFilename` to the existing import instead of adding a second import line.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/data/csv-shared.test.ts`
Expected: FAIL — `assetCsvFilename is not a function`.

- [ ] **Step 3: Implement `assetCsvFilename`**

Append to `src/lib/data/csv-shared.ts`:

```typescript
/** Build the download filename for an asset CSV. Slugifies the asset name to ASCII;
 *  when that yields nothing (e.g. an all-CJK name) or the name is blank, falls back
 *  to the asset id so the file is never named `kita-asset-.csv`. */
export function assetCsvFilename(name: string, id: string): string {
  const slug = name.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase()
  return `kita-asset-${slug || id}.csv`
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/data/csv-shared.test.ts`
Expected: PASS.

- [ ] **Step 5: Use it in the export route**

In `src/app/(app)/report/export/route.ts`, add `assetCsvFilename` to the existing `csv-shared` import:

```typescript
import { toCsv, centsToDecimal, assetCsvFilename } from '@/lib/data/csv-shared'
```

Replace the asset-branch filename block:

```typescript
    const safeName = result.asset.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    return csvResponse(`kita-asset-${safeName}.csv`, csv)
```

with:

```typescript
    return csvResponse(assetCsvFilename(result.asset.name, result.asset.id), csv)
```

- [ ] **Step 6: Add the asset detail CSV download link + `asset.exportCsv` / `assets.closed` keys**

In `src/i18n/dictionaries.ts`, add to the **en** block:

```typescript
    'assets.closed': 'Closed',
    'asset.exportCsv': 'Download CSV',
```

And to the **zh** block:

```typescript
    'assets.closed': '已关闭',
    'asset.exportCsv': '下载 CSV',
```

In `src/app/(app)/assets/[id]/page.tsx`, add a `Download` icon to the lucide import:

```typescript
import { Pencil, Download } from 'lucide-react'
```

Add a download link after `<AddTxn ... />` (a plain `<a download>` — the route is a GET Route Handler, no client JS needed):

```tsx
      <AddTxn assetId={asset.id} defaultDirection={defaultDirection} />

      <a
        href={`/report/export?type=asset&id=${asset.id}`}
        download
        className="pressable flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] py-3 text-sm font-bold text-[var(--ink)]"
      >
        <Download size={16} className="text-[var(--muted)]" />
        {t(locale, 'asset.exportCsv')}
      </a>
```

Also fix the reused closed label — replace:

```tsx
            {asset.status === 'closed' ? ` · ${t(locale, 'status.closed')}` : ''}
```

with:

```tsx
            {asset.status === 'closed' ? ` · ${t(locale, 'assets.closed')}` : ''}
```

### 5b — Fund header pencil (44px + aria-expanded)

- [ ] **Step 7: Enlarge the fund config pencil tap target and expose expanded state**

In `src/app/(app)/fund/FundView.tsx`, replace the pencil button:

```tsx
          <button
            type="button"
            onClick={() => setEditingConfig((v) => !v)}
            aria-label={t('fund.editConfig')}
            className="pressable-opacity grid h-9 w-9 place-items-center rounded-full text-[var(--muted)]"
          >
            <Pencil size={16} />
          </button>
```

with:

```tsx
          <button
            type="button"
            onClick={() => setEditingConfig((v) => !v)}
            aria-label={t('fund.editConfig')}
            aria-expanded={editingConfig}
            className="pressable-opacity grid h-11 w-11 place-items-center rounded-full text-[var(--muted)]"
          >
            <Pencil size={16} />
          </button>
```

### 5c — MonthBars a11y + non-color sign cue

- [ ] **Step 8: Drop the contradictory role and add a shape-based sign cue**

In `src/app/(app)/report/MonthBars.tsx`, replace the whole return so the wrapper is `aria-hidden` only (no `role="img"`), and, in `signed` mode, render a caret above each non-zero bar (▲ up for positive, ▼ down for negative) — a shape cue that does not rely on color alone:

```tsx
  return (
    <div className="flex items-end gap-[3px]" aria-hidden="true">
      {values.map((v, i) => {
        const pct = maxValue > 0 ? Math.round((Math.abs(v) / maxValue) * 100) : 0
        const bg = signed && v < 0 ? 'var(--danger)' : 'var(--primary)'
        return (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            {signed && (
              <span className="text-[8px] leading-none" style={{ color: bg }}>
                {v > 0 ? '▲' : v < 0 ? '▼' : ''}
              </span>
            )}
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
```

Also update the component's doc comment so it no longer references `role="img"`. Replace the JSDoc block's last sentence "Pure presentational Server Component; no chart lib." remains, but change the signed sentence to: `When `signed`, negative values render red with a ▼ caret and positive values a ▲ caret above the bar, so sign is legible without relying on color.`

### 5d — Expenses swipe row: reset dragX before Edit navigation

- [ ] **Step 9: Close the row before navigating to Edit**

In `src/app/(app)/expenses/ExpensesView.tsx`, in `ExpenseRowCard`, replace the Edit button's handler:

```tsx
          onClick={() => router.push(`/expenses/edit/${row.id}`)}
```

with:

```tsx
          onClick={() => {
            setDragX(0)
            router.push(`/expenses/edit/${row.id}`)
          }}
```

- [ ] **Step 10: Verify build + tests**

Run: `npm run lint && npx vitest run src/lib/data/csv-shared.test.ts`
Expected: lint clean; CSV tests PASS.

Manual: `/assets/<id>` shows a "Download CSV" button that downloads `kita-asset-<slug|id>.csv`; a closed asset's subtitle shows the dedicated 已关闭 label in zh; the Fund pencil is a 44px target; the Report personal-balance bars show ▲/▼ carets; swiping an expense row open, tapping Edit, then navigating back leaves the row closed.

- [ ] **Step 11: Commit**

```bash
git add src/lib/data/csv-shared.ts src/lib/data/csv-shared.test.ts "src/app/(app)/report/export/route.ts" "src/app/(app)/assets/[id]/page.tsx" "src/app/(app)/fund/FundView.tsx" "src/app/(app)/report/MonthBars.tsx" "src/app/(app)/expenses/ExpensesView.tsx" src/i18n/dictionaries.ts
git commit -m "fix(a11y/ux): asset CSV download, fund pencil, MonthBars sign cue, swipe reset, closed label"
```

---

## Self-Review

**1. Spec coverage (§3 Phase 11 + follow-ups):**
- 中文 names — Task 1 (form inputs + zh-aware readers/actions + backfill SQL). Display already uses zh via `localizedName`. ✅
- Computed "On track" — Task 2 `budgetPaceKey`. ✅
- Time-of-day greeting — Task 2 `greetingKey`, MYT justified server-side. ✅
- Budget month stepper — Task 3. ✅
- Delete confirmations (ledger + asset txn) — Task 4. ✅
- Asset CSV download + all-CJK slug fallback — Task 5a. ✅
- Fund pencil 44px + aria-expanded — Task 5b. ✅
- MonthBars role fix + non-color sign cue — Task 5c. ✅
- Expenses swipe dragX reset on Edit — Task 5d (Step 9). ✅
- zh dedicated assets closed label — Task 5a (Step 6). ✅

**2. Placeholder scan:** No TBD/TODO/"handle edge cases"/"similar to". Every code step shows complete code. ✅

**3. Type consistency:** `nameZh: string | null` used uniformly across `CategoryRow`/`CommitmentRow`, action inputs (`createCategory`/`updateCategory`/`createCommitment`/`updateCommitment`), and the `BudgetManager` callbacks (`onSave`/`onAdd` all take `(nameEn, nameZh, ...)`). `localizedName(nameEn, nameZh, locale)` signature matches its callers in `budget/page.tsx` and `home.ts`. `greetingKey`/`budgetPaceKey`/`assetCsvFilename` signatures match their tests and call sites. `MonthStepper`/`ConfirmButton` prop names match usage. ✅

**De-scopes / judgment calls (for the orchestrator):**
- **Backfill is data-only SQL, run by hand.** Per CLAUDE.md there is no migration tooling; `0004_name_zh_backfill.sql` is `UPDATE`-only, idempotent, and scoped to the seed household id `...aa`. If the live household id differs, the `WHERE` clauses must be adjusted before running — call this out to the user.
- **zh translations are my best-effort** for the 7 categories + 8 commitments; the user should sanity-check the wording (e.g. "Leo 医疗备用金" for "Leo fund in case sick").
- **No unit tests for pure-UI interactions** (ConfirmButton two-tap, stepper navigation, swipe reset) — they have no framework-free logic to isolate; verified manually. The pure pieces (`localizedName`, `greetingKey`, `budgetPaceKey`, `assetCsvFilename`) are TDD-covered.
- **Did not refactor Expenses/Personal to use the new `MonthStepper`** — they carry extra query state (Personal has `member`) and work today; folding them in would widen scope beyond Phase 11. The component is written generically so a later cleanup is easy.
- **Greeting/pace computed server-side in MYT** rather than via a client `Date` component — avoids hydration mismatch and keeps Home a Server Component; MYT has no DST so the fixed +8h shift is exact.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-05-phase-11-polish.md`. Two execution options:

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task with two-stage review between tasks.

**2. Inline Execution** — execute tasks in this session using executing-plans, batching with checkpoints.

Which approach?
