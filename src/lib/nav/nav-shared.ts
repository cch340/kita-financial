// Pure, framework-free nav model. No Supabase, no next/headers, no React.
// Icons are referenced by name; the name->component map lives beside the renderers.

export type TabId = 'home' | 'expenses' | 'fund' | 'budget' | 'assets' | 'manage'

export type NavLayout = { bar: TabId[]; more: TabId[] }

export type TabDef = {
  id: TabId
  href: string
  i18nKey: string
  iconName: string
  matchPrefixes: string[]
}

export const MAX_BAR = 4

// Order here is the canonical default order.
export const TAB_DEFS: TabDef[] = [
  { id: 'home', href: '/', i18nKey: 'nav.home', iconName: 'home', matchPrefixes: ['/personal'] },
  { id: 'expenses', href: '/expenses', i18nKey: 'nav.expenses', iconName: 'expenses', matchPrefixes: [] },
  { id: 'fund', href: '/fund', i18nKey: 'nav.fund', iconName: 'fund', matchPrefixes: [] },
  { id: 'budget', href: '/budget', i18nKey: 'nav.budget', iconName: 'budget', matchPrefixes: [] },
  { id: 'assets', href: '/assets', i18nKey: 'nav.assets', iconName: 'assets', matchPrefixes: [] },
  { id: 'manage', href: '/manage', i18nKey: 'nav.manage', iconName: 'manage', matchPrefixes: [] },
]

export const TAB_IDS: TabId[] = TAB_DEFS.map((d) => d.id)

export const DEFAULT_LAYOUT: NavLayout = {
  bar: ['home', 'expenses', 'fund', 'budget'],
  more: ['assets', 'manage'],
}

function cloneDefault(): NavLayout {
  return { bar: [...DEFAULT_LAYOUT.bar], more: [...DEFAULT_LAYOUT.more] }
}

function isTabId(v: unknown): v is TabId {
  return typeof v === 'string' && (TAB_IDS as string[]).includes(v)
}

// Always returns a complete, valid layout: known ids only, no duplicates
// (bar wins), every tab present exactly once, bar length 1..MAX_BAR.
export function parseLayout(raw: unknown): NavLayout {
  if (!raw || typeof raw !== 'object') return cloneDefault()
  const r = raw as Record<string, unknown>
  const seen = new Set<TabId>()
  const take = (v: unknown): TabId[] => {
    if (!Array.isArray(v)) return []
    const out: TabId[] = []
    for (const x of v) {
      if (isTabId(x) && !seen.has(x)) { seen.add(x); out.push(x) }
    }
    return out
  }
  let bar = take(r.bar)
  let more = take(r.more)
  // Append any known ids not present in either list.
  for (const id of TAB_IDS) {
    if (!seen.has(id)) { seen.add(id); more.push(id) }
  }
  // Enforce the bar cap; overflow spills to the front of more.
  if (bar.length > MAX_BAR) {
    more = [...bar.slice(MAX_BAR), ...more]
    bar = bar.slice(0, MAX_BAR)
  }
  // The bar must never be empty.
  if (bar.length === 0) return cloneDefault()
  return { bar, more }
}

function tabMatches(def: TabDef, pathname: string): boolean {
  if (pathname === def.href) return true
  if (def.href !== '/' && pathname.startsWith(def.href)) return true
  return def.matchPrefixes.some((p) => pathname.startsWith(p))
}

// Returns the id of the matching bar tab, 'more' if the match lives in the
// More list (or the pathname is /more), or null if nothing matches.
export function resolveActiveTab(pathname: string, layout: NavLayout): TabId | 'more' | null {
  if (pathname === '/more' || pathname.startsWith('/more/')) return 'more'
  for (const def of TAB_DEFS) {
    if (tabMatches(def, pathname)) {
      return layout.bar.includes(def.id) ? def.id : 'more'
    }
  }
  return null
}

// Resolve an ordered list of tab ids to their definitions, dropping any unknown id.
export function defsFor(ids: TabId[]): TabDef[] {
  return ids
    .map((id) => TAB_DEFS.find((d) => d.id === id))
    .filter((d): d is TabDef => Boolean(d))
}
