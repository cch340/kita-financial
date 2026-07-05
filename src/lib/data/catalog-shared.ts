// Pure, server/client-safe catalog helpers — no supabase / next/headers here.
// Shared by the three per-kind modules (categories/vendors/locations) and their tests.
export type CatalogItem = { id: string; name: string; sort_order: number }

/** Trim and collapse internal runs of whitespace to a single space. */
export function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

/** Case-insensitive duplicate lookup (after normalize), optionally excluding one id. */
export function findCaseInsensitiveDuplicate(
  name: string, existing: CatalogItem[], exceptId?: string,
): CatalogItem | null {
  const key = normalizeName(name).toLowerCase()
  return existing.find((i) => i.id !== exceptId && normalizeName(i.name).toLowerCase() === key) ?? null
}

/** Next sort_order = max existing + 1, or 0 when empty. */
export function nextSortOrder(existing: CatalogItem[]): number {
  return existing.length === 0 ? 0 : Math.max(...existing.map((i) => i.sort_order)) + 1
}
