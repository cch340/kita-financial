import Link from 'next/link'
import { Plus } from 'lucide-react'

// Fixed positioning lives on the wrapper, not the link: `.pressable` sets
// `position: relative` in the same @layer as Tailwind's `fixed` utility and would
// win, leaving the button in normal flow (scrolling with the page).
//
// The wrapper spans the viewport but is pointer-events-none; an inner max-w-[430px]
// column (mirroring the app shell) right-aligns the FAB so it hugs the phone frame's
// right edge on any screen width, not the browser window's.
export function Fab({ href, label }: { href: string; label?: string }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[100px] z-40">
      <div className="mx-auto flex max-w-[430px] justify-end px-[18px]">
        <Link
          href={href}
          aria-label={label}
          className={
            label
              ? 'pressable pointer-events-auto flex h-14 min-h-[44px] items-center gap-2 rounded-full bg-[var(--primary-btn)] px-5 text-sm font-bold text-white shadow-[0_10px_24px_-6px_var(--primary)] active:shadow-[0_4px_12px_-6px_var(--primary)]'
              : 'pressable pointer-events-auto flex h-14 w-14 min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-[var(--primary-btn)] text-white shadow-[0_10px_24px_-6px_var(--primary)] active:shadow-[0_4px_12px_-6px_var(--primary)]'
          }
        >
          <Plus size={22} strokeWidth={2.5} />
          {label && <span>{label}</span>}
        </Link>
      </div>
    </div>
  )
}
