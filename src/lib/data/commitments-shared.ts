// Pure, server/client-safe commitment helpers and types — no supabase import here.
export type Commitment = {
  name: string
  amountCents: number
  remark: string | null
}
export type CommitmentRow = Commitment & {
  id: string
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
