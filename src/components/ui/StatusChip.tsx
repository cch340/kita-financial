'use client'
import { Check, Circle } from 'lucide-react'
import { useT } from '@/i18n/LocaleProvider'

export type ChipStatus = 'paid' | 'pending' | 'upcoming' | 'closed'

const STYLE: Record<ChipStatus, { bg: string; text: string }> = {
  paid: { bg: 'var(--positive-bg)', text: 'var(--positive-text)' },
  pending: { bg: 'var(--pending-bg)', text: 'var(--pending-text)' },
  upcoming: { bg: 'var(--pending-bg)', text: 'var(--pending-text)' },
  closed: { bg: 'var(--subtle)', text: 'var(--muted)' },
}

export function StatusChip({ status }: { status: ChipStatus }) {
  const s = STYLE[status]
  const t = useT()
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap"
      style={{ background: s.bg, color: s.text }}
    >
      {status === 'paid' && <Check size={12} strokeWidth={3} />}
      {(status === 'pending' || status === 'upcoming') && (
        <Circle size={7} strokeWidth={0} fill="currentColor" className="animate-pulse" />
      )}
      {t(`status.${status}`)}
    </span>
  )
}
