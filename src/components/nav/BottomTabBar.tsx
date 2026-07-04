'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Receipt, HandCoins, ChartColumn, LayoutGrid } from 'lucide-react'
const TABS = [
  { href: '/', label: 'Home', Icon: Home },
  { href: '/expenses', label: 'Expenses', Icon: Receipt },
  { href: '/fund', label: 'Fund', Icon: HandCoins },
  { href: '/budget', label: 'Budget', Icon: ChartColumn },
  { href: '/assets', label: 'Assets', Icon: LayoutGrid },
]
export function BottomTabBar() {
  const path = usePathname()
  return (
    <nav className="fixed inset-x-0 bottom-0 h-[84px] border-t border-[var(--hairline)] bg-[var(--surface)]"
         style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <ul className="mx-auto flex h-[60px] max-w-[430px] items-stretch justify-around">
        {TABS.map(({ href, label, Icon }) => {
          const active = href === '/' ? path === '/' : path.startsWith(href)
          return (
            <li key={href} className="flex-1">
              <Link href={href} className="flex h-full flex-col items-center justify-center gap-1"
                    style={{ color: active ? 'var(--primary)' : 'var(--faint)' }}>
                <Icon size={22} strokeWidth={active ? 2.4 : 2} />
                <span className="text-[10px] font-semibold">{label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
