import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getMembership } from '@/lib/data/household'
import { t } from '@/i18n'

export default async function PushDemoPage() {
  const m = await getMembership()
  const locale = m?.language ?? 'en'
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto"
      style={{ background: 'linear-gradient(160deg, #2a1d16, #4a2f22)' }}>
      <div className="mx-auto flex min-h-full max-w-[430px] flex-col px-[18px] pb-10 pt-4 text-white">
        <Link href="/settings" aria-label={t(locale, 'common.back')} className="grid h-11 w-11 place-items-center -ml-2 text-white/70">
          <ChevronLeft size={24} />
        </Link>
        <div className="mt-8 text-center">
          <p className="text-6xl font-extralight tracking-tight">9:41</p>
          <p className="mt-1 text-sm font-semibold text-white/70">Saturday, 4 July</p>
        </div>
        <div className="mt-10 flex flex-col gap-3">
          {[
            { title: t(locale, 'push.monthly.title'), body: t(locale, 'push.monthly.body') },
            { title: t(locale, 'push.yearly.title'), body: t(locale, 'push.yearly.body') },
          ].map((n, i) => (
            <div key={i} className="flex items-start gap-3 rounded-2xl bg-white/15 p-3.5 backdrop-blur-md"
              style={{ boxShadow: '0 6px 18px rgba(0,0,0,.18)' }}>
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--primary)] text-xs font-black">K</div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold tracking-wide">KITA</span>
                  <span className="text-xs text-white/60">now</span>
                </div>
                <p className="text-sm font-bold">{n.title}</p>
                <p className="text-xs text-white/80">{n.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
