// Pure, server/client-safe budget helpers and types — no supabase import here.
export type CategoryRow = {
  id: string
  nameEn: string
  jcCents: number
  chCents: number
  totalCents: number
  sortOrder: number
}
export type CommitmentRow = {
  id: string
  nameEn: string
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
