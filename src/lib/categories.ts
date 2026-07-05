export type CategoryKey =
  | 'food' | 'groceries' | 'transport' | 'house' | 'leo' | 'dining' | 'utilities' | 'health' | 'uncategorized'

export const CATEGORIES: { key: CategoryKey; en: string; zh: string; icon: string; tint: string }[] = [
  { key: 'food',        en: 'Food',       zh: '餐饮',   icon: 'Utensils',     tint: 'var(--pending-bg)' },
  { key: 'groceries',   en: 'Groceries',  zh: '杂货',   icon: 'ShoppingCart', tint: 'var(--positive-bg)' },
  { key: 'transport',   en: 'Transport',  zh: '交通',   icon: 'Car',          tint: 'var(--info-bg)' },
  { key: 'house',       en: 'House',      zh: '房屋',   icon: 'Home',         tint: 'var(--subtle)' },
  { key: 'leo',         en: 'Leo',        zh: 'Leo',    icon: 'Baby',         tint: 'var(--peach)' },
  { key: 'dining',      en: 'Dining',     zh: '外食',   icon: 'CookingPot',   tint: 'var(--pending-bg)' },
  { key: 'utilities',   en: 'Utilities',  zh: '水电',   icon: 'Plug',         tint: 'var(--info-bg)' },
  { key: 'health',      en: 'Health',     zh: '健康',   icon: 'HeartPulse',   tint: 'var(--positive-bg)' },
]

const LABELS: Record<string, { en: string; zh: string }> = Object.fromEntries(
  [
    ...CATEGORIES,
    { key: 'uncategorized', en: 'Uncategorized', zh: '未分类', icon: 'Tag', tint: 'var(--subtle)' },
  ].map((c) => [c.key, { en: c.en, zh: c.zh }])
)

export function categoryLabel(key: string | null, locale: 'en' | 'zh'): string {
  const k = key ?? 'uncategorized'
  return LABELS[k]?.[locale] ?? LABELS['uncategorized'][locale]
}

const CATEGORY_KEY_SET: ReadonlySet<string> = new Set(CATEGORIES.map((c) => c.key))

// True only for the fixed expense categories (excludes 'uncategorized', which is a
// display-only fallback, not an assignable category).
export function isCategoryKey(k: string): k is CategoryKey {
  return CATEGORY_KEY_SET.has(k)
}
