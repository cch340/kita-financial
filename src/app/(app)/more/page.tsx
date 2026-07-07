import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { getMembership } from '@/lib/data/household'
import { t } from '@/i18n'
import { TAB_DEFS, DEFAULT_LAYOUT } from '@/lib/nav/nav-shared'
import { TAB_ICONS } from '@/components/nav/tab-icons'

export default async function MorePage() {
  const m = await getMembership()
  const locale = m?.language ?? 'en'
  const layout = m?.tabOrder ?? DEFAULT_LAYOUT
  const items = layout.more
    .map((id) => TAB_DEFS.find((d) => d.id === id))
    .filter((d): d is (typeof TAB_DEFS)[number] => Boolean(d))
  return (
    <div className="flex flex-col gap-5 pb-6">
      <h1 className="text-2xl font-extrabold text-[var(--ink-head)]">{t(locale, 'more.title')}</h1>
      <div className="flex flex-col gap-2">
        {items.map((def) => {
          const Icon = TAB_ICONS[def.id]
          return (
            <Link
              key={def.id}
              href={def.href}
              className="pressable flex min-h-[56px] items-center gap-3 rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--subtle)]">
                <Icon size={20} className="text-[var(--ink)]" />
              </span>
              <span className="flex-1 text-sm font-bold text-[var(--ink)]">{t(locale, def.i18nKey)}</span>
              <ChevronRight size={18} className="text-[var(--faint)]" />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
