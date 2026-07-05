import Link from 'next/link'
import { Plus } from 'lucide-react'

export function Fab({ href, label }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className={
        label
          ? 'pressable fixed right-[18px] bottom-[100px] z-40 flex h-14 min-h-[44px] items-center gap-2 rounded-full bg-[var(--primary-btn)] px-5 text-sm font-bold text-white shadow-[0_10px_24px_-6px_var(--primary)] active:shadow-[0_4px_12px_-6px_var(--primary)]'
          : 'pressable fixed right-[18px] bottom-[100px] z-40 flex h-14 w-14 min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-[var(--primary-btn)] text-white shadow-[0_10px_24px_-6px_var(--primary)] active:shadow-[0_4px_12px_-6px_var(--primary)]'
      }
    >
      <Plus size={22} strokeWidth={2.5} />
      {label && <span>{label}</span>}
    </Link>
  )
}
