import { dictionaries, type Locale } from './dictionaries'
export type { Locale }
export function t(locale: Locale, key: string): string {
  return dictionaries[locale]?.[key] ?? dictionaries.en[key] ?? key
}
