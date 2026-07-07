// Pure, server/client-safe recurring-fund helpers and types — no supabase import here.
import type { Member } from './types'

export type { Member }
export type RecurringFund = {
  id: string
  memberCode: Member
  name: string
  amountCents: number
  remark: string | null
  sortOrder: number
}
export type RecurringFundInput = {
  name: string
  amountCents: number
  remark: string | null
  members: Member[]
}
export type RecurringFundInsert = {
  member_code: Member
  name: string
  amount_cents: number
  remark: string | null
}

/** Expand one add-form submission into one DB insert row per selected member. */
export function fanOutRecurring(input: RecurringFundInput): RecurringFundInsert[] {
  return input.members.map((member_code) => ({
    member_code,
    name: input.name,
    amount_cents: input.amountCents,
    remark: input.remark,
  }))
}

/** Sum of a member's recurring-fund amounts — the suggested contribution amount. */
export function sumForMember(member: Member, funds: RecurringFund[]): number {
  return funds.filter((f) => f.memberCode === member).reduce((a, f) => a + f.amountCents, 0)
}
