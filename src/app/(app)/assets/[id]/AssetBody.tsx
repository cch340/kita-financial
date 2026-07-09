'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ArrowDown, ArrowUp, Pencil, ChevronDown, ChevronRight, ChevronUp, SlidersHorizontal } from 'lucide-react'
import { useT } from '@/i18n/LocaleProvider'
import { HeroCard, Card } from '@/components/ui/Card'
import { MoneyText } from '@/components/ui/MoneyText'
import { runningBalanceCents, groupByCategory } from '@/lib/data/assets-shared'
import type { Asset, AssetTxn, AssetCategory, CategoryGroup } from '@/lib/data/assets-shared'
import type { Commitment } from '@/lib/data/commitments-shared'

export function AssetBody({ asset, txns, categories, commitments }: {
  asset: Asset; txns: AssetTxn[]; categories: AssetCategory[]; commitments: Commitment[]
}) {
  const t = useT()
  const balance = runningBalanceCents(asset.openingBalanceCents, txns)
  const hasOpening = (asset.openingBalanceCents ?? 0) !== 0
  const groups = groupByCategory(txns, categories, t('asset.category.other'))

  return (
    <div className="flex flex-col gap-4">
      <HeroCard>
        <span className="text-sm font-bold opacity-90">{t('asset.balance')}</span>
        <div className="mt-1"><MoneyText cents={balance} className="text-[32px] font-extrabold" /></div>
      </HeroCard>

      <CommitmentsSection assetId={asset.id} commitments={commitments} />

      {groups.length === 0 && !hasOpening ? (
        <p className="py-10 text-center text-sm font-semibold text-[var(--faint)]">{t('asset.empty')}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((g) => <TxnGroup key={g.categoryId ?? '__other'} assetId={asset.id} group={g} />)}
          {hasOpening && (
            <Card className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-[var(--muted)]">{t('asset.openingBalance')}</span>
              <MoneyText cents={asset.openingBalanceCents ?? 0} className="text-sm font-bold text-[var(--muted)]" />
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

function TxnGroup({ assetId, group }: { assetId: string; group: CategoryGroup }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="pressable-opacity flex items-center gap-2 px-1">
        {open ? <ChevronDown size={16} className="text-[var(--muted)]" /> : <ChevronRight size={16} className="text-[var(--muted)]" />}
        <span className="flex-1 text-left text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{group.name}</span>
        <MoneyText cents={group.subtotalCents} className="text-xs font-bold text-[var(--faint)]" />
      </button>
      {open && (
        <Card className="flex flex-col gap-3">
          {group.rows.map((txn) => <TxnRow key={txn.id} assetId={assetId} txn={txn} />)}
        </Card>
      )}
    </div>
  )
}

function TxnRow({ assetId, txn }: { assetId: string; txn: AssetTxn }) {
  const t = useT()
  const isIn = txn.direction === 'in'
  const arrowColor = isIn ? 'var(--positive-text)' : 'var(--primary)'
  return (
    <div className="flex items-start gap-3 border-t border-[var(--hairline)] pt-3 first:border-t-0 first:pt-0">
      {isIn
        ? <ArrowDown size={18} strokeWidth={2.5} className="mt-0.5 shrink-0" style={{ color: arrowColor }} />
        : <ArrowUp size={18} strokeWidth={2.5} className="mt-0.5 shrink-0" style={{ color: arrowColor }} />}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[var(--ink)]">{txn.description ?? '—'}</p>
        <p className="text-xs text-[var(--muted)]">{txn.date} · {t(isIn ? 'asset.in' : 'asset.out')}</p>
        {txn.notes && <p className="mt-0.5 text-xs italic text-[var(--faint)]">{txn.notes}</p>}
      </div>
      <span className="shrink-0 text-sm font-bold tabular-nums" style={{ color: isIn ? arrowColor : 'var(--ink-head)' }}>
        {isIn ? '+' : '−'} <MoneyText cents={txn.amountCents} />
      </span>
      <Link href={`/assets/${assetId}/txn/${txn.id}`} aria-label={t('asset.editTxn')}
        className="pressable-opacity grid h-8 w-8 shrink-0 place-items-center text-[var(--muted)]">
        <Pencil size={15} />
      </Link>
    </div>
  )
}

function CommitmentsSection({ assetId, commitments }: { assetId: string; commitments: Commitment[] }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const total = commitments.reduce((a, c) => a + c.amountCents, 0)
  return (
    <Card className="flex flex-col">
      <div className="-my-1 flex items-center justify-between gap-2">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
          className="pressable-opacity flex min-w-0 flex-1 items-center text-left">
          <span className="truncate text-sm font-bold text-[var(--ink-head)]">{t('asset.commitments.title')}</span>
        </button>
        <div className="flex shrink-0 items-center gap-0.5">
          <Link href={`/assets/${assetId}/commitments`} aria-label={t('common.manage')}
            className="pressable-opacity grid h-8 w-8 place-items-center text-[var(--muted)]">
            <SlidersHorizontal size={18} />
          </Link>
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={t('asset.commitments.title')}
            className="pressable-opacity grid h-8 w-8 place-items-center text-[var(--muted)]">
            {open ? <ChevronUp size={18} strokeWidth={2.5} /> : <ChevronDown size={18} strokeWidth={2.5} />}
          </button>
        </div>
      </div>

      {open && (commitments.length === 0 ? (
        <p className="mt-3 border-t border-[var(--hairline)] pt-3 text-center text-sm font-semibold text-[var(--faint)]">
          {t('asset.commitments.empty')}
        </p>
      ) : (
        <div className="mt-2 flex flex-col">
          {commitments.map((c, i) => (
            <div key={i} className="flex items-center justify-between gap-2 border-t border-[var(--hairline)] py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[var(--ink-head)]">{c.name}</p>
                {c.remark && <p className="truncate text-xs text-[var(--muted)]">{c.remark}</p>}
              </div>
              <MoneyText cents={c.amountCents} className="shrink-0 text-sm font-bold text-[var(--ink-head)]" />
            </div>
          ))}
          <div className="flex items-center justify-between gap-2 border-t border-[var(--hairline)] pt-2.5">
            <span className="text-sm font-bold text-[var(--ink-head)]">{t('asset.commitments.total')}</span>
            <MoneyText cents={total} className="text-sm font-extrabold text-[var(--ink-head)]" />
          </div>
        </div>
      ))}
    </Card>
  )
}
