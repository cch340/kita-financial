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
