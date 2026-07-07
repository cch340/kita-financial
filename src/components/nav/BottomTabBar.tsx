'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useT } from '@/i18n/LocaleProvider'
import { TAB_DEFS, resolveActiveTab, type NavLayout, type TabDef } from '@/lib/nav/nav-shared'
import { TAB_ICONS, MORE_ICON } from './tab-icons'

export function BottomTabBar({ layout }: { layout: NavLayout }) {
  const path = usePathname()
  const t = useT()
  const active = resolveActiveTab(path, layout)
  const barTabs = layout.bar
    .map((id) => TAB_DEFS.find((d) => d.id === id))
    .filter((d): d is TabDef => Boolean(d))

  const linkClass = 'pressable-opacity flex h-full flex-col items-center justify-center gap-1 transition-colors'
  const labelClass = 'text-[10px] font-semibold'

  return (
    <nav className="fixed inset-x-0 bottom-0 h-[84px] border-t border-[var(--hairline)] bg-[var(--surface)]"
         style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <ul className="mx-auto flex h-[60px] max-w-[430px] items-stretch justify-around">
        {barTabs.map((tab) => {
          const Icon = TAB_ICONS[tab.id]
          const isActive = active === tab.id
          return (
            <li key={tab.id} className="flex-1">
              <Link href={tab.href} className={linkClass}
                    style={{ color: isActive ? 'var(--primary)' : 'var(--faint)' }}>
                <Icon size={22} strokeWidth={isActive ? 2.4 : 2} />
                <span className={labelClass}>{t(tab.i18nKey)}</span>
              </Link>
            </li>
          )
        })}
        <li key="more" className="flex-1">
          <Link href="/more" className={linkClass}
                style={{ color: active === 'more' ? 'var(--primary)' : 'var(--faint)' }}>
            <MORE_ICON size={22} strokeWidth={active === 'more' ? 2.4 : 2} />
            <span className={labelClass}>{t('nav.more')}</span>
          </Link>
        </li>
      </ul>
    </nav>
  )
}
