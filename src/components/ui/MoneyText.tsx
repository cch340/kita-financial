import { formatRM } from '@/lib/money'

export function MoneyText({ cents, className = '' }: { cents: number; className?: string }) {
  return <span className={`tabular-nums ${className}`}>{formatRM(cents)}</span>
}
