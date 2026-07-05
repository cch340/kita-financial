export type Member = 'CH' | 'JC'
export type ExpenseRow = {
  id: string
  date: string
  vendor: string | null
  location: string | null
  details: string | null
  category: string | null
  amount_cents: number
  paid_by: Member | null
}
export type DayGroup = { date: string; label: string; totalCents: number; rows: ExpenseRow[] }
export type Membership = { householdId: string; memberCode: Member; language: 'en' | 'zh'; displayName: string }
