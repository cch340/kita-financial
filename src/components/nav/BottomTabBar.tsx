'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Receipt, HandCoins, ChartColumn, LayoutGrid } from 'lucide-react'
import { useT } from '@/i18n/LocaleProvider'
const TABS = [
  { href: '/', key: 'nav.home', Icon: Home },
  { href: '/expenses', key: 'nav.expenses', Icon: Receipt },
  { href: '/fund', key: 'nav.fund', Icon: HandCoins },
  { href: '/budget', key: 'nav.budget', Icon: ChartColumn },
  { href: '/assets', key: 'nav.assets', Icon: LayoutGrid },
]
export function BottomTabBar() {
  const path = usePathname()
  const t = useT()
  return (
    <nav className="fixed inset-x-0 bottom-0 h-[84px] border-t border-[var(--hairline)] bg-[var(--surface)]"
         style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <ul className="mx-auto flex h-[60px] max-w-[430px] items-stretch justify-around">
        {TABS.map(({ href, key, Icon }) => {
          const active = href === '/' ? path === '/' || path.startsWith('/personal') : path.startsWith(href)
          return (
            <li key={href} className="flex-1">
              <Link href={href} className="pressable-opacity flex h-full flex-col items-center justify-center gap-1 transition-colors"
                    style={{ color: active ? 'var(--primary)' : 'var(--faint)' }}>
                <Icon size={22} strokeWidth={active ? 2.4 : 2} />
                <span className="text-[10px] font-semibold">{t(key)}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
