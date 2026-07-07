import type { NavLayout } from '@/lib/nav/nav-shared'

export type Member = 'CH' | 'JC'
export type ExpenseRow = {
  id: string
  date: string
  details: string | null
  amount_cents: number
  paid_by: Member | null
  category_id: string | null
  vendor_id: string | null
  location_id: string | null
  category_name: string | null
  vendor_name: string | null
  location_name: string | null
}
export type DayGroup = { date: string; label: string; totalCents: number; rows: ExpenseRow[] }
export type Membership = {
  householdId: string
  memberCode: Member
  language: 'en' | 'zh'
  displayName: string
  tabOrder: NavLayout
}
