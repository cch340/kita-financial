import Link from 'next/link'
import { LayoutGrid, SlidersHorizontal, ChevronRight } from 'lucide-react'
import { getMembership } from '@/lib/data/household'
import { t } from '@/i18n'

export default async function MorePage() {
  const m = await getMembership()
  const locale = m?.language ?? 'en'
  const items = [
    { href: '/assets', label: t(locale, 'more.assets'), Icon: LayoutGrid },
    { href: '/manage', label: t(locale, 'more.manage'), Icon: SlidersHorizontal },
  ]
  return (
    <div className="flex flex-col gap-5 pb-6">
      <h1 className="text-2xl font-extrabold text-[var(--ink-head)]">{t(locale, 'more.title')}</h1>
      <div className="flex flex-col gap-2">
        {items.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className="pressable flex min-h-[56px] items-center gap-3 rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--subtle)]">
              <Icon size={20} className="text-[var(--ink)]" />
            </span>
            <span className="flex-1 text-sm font-bold text-[var(--ink)]">{label}</span>
            <ChevronRight size={18} className="text-[var(--faint)]" />
          </Link>
        ))}
      </div>
    </div>
  )
}
