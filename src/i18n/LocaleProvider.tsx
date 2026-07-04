'use client'
import { createContext, useContext } from 'react'
import { t as translate, type Locale } from './index'

const LocaleContext = createContext<Locale>('en')
export function LocaleProvider({ initialLocale, children }: { initialLocale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={initialLocale}>{children}</LocaleContext.Provider>
}
export function useLocale(): Locale {
  return useContext(LocaleContext)
}
export function useT() {
  const locale = useLocale()
  return (key: string) => translate(locale, key)
}
