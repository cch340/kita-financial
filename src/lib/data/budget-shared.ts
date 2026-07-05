// Pure, server/client-safe budget helpers and types — no supabase import here.
export type CategoryRow = {
  id: string
  nameEn: string
  nameZh: string | null
  jcCents: number
  chCents: number
  totalCents: number
  sortOrder: number
}
export type CommitmentRow = {
  id: string
  nameEn: string
  nameZh: string | null
  amountCents: number
  sortOrder: number
}

export function moveItem<T>(items: T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta
  if (target < 0 || target >= items.length) return items.slice()
  const next = items.slice()
  const [moved] = next.splice(index, 1)
  next.splice(target, 0, moved)
  return next
}

/** Pick the display name for the given locale, falling back to English when the
 *  Chinese name is missing or blank. Keeps the zh-fallback rule in one tested place. */
export function localizedName(nameEn: string, nameZh: string | null, locale: 'en' | 'zh'): string {
  if (locale === 'zh' && nameZh && nameZh.trim()) return nameZh
  return nameEn
}
