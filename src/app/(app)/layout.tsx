/// <reference types="react/canary" />
import { ViewTransition } from 'react'
import { BottomTabBar } from '@/components/nav/BottomTabBar'
import { LocaleProvider } from '@/i18n/LocaleProvider'
import { getMembership } from '@/lib/data/household'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const membership = await getMembership()
  const locale = membership?.language ?? 'en'
  return (
    <LocaleProvider initialLocale={locale}>
      <div className="min-h-dvh bg-[var(--paper)]">
        <div className="mx-auto max-w-[430px] px-[18px] pb-[96px] pt-4">
          <ViewTransition enter="page-enter" exit="page-exit">
            {children}
          </ViewTransition>
        </div>
        <BottomTabBar />
      </div>
    </LocaleProvider>
  )
}
