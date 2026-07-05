export type ReminderRecipient = { userId: string; language: 'en' | 'zh'; monthly: boolean; yearly: boolean }
export type BigPayment = { dateISO: string }
export type DueReminder = { userId: string; kind: 'monthly' | 'yearly' }

const DAY = 86_400_000
const YEARLY_WINDOW_DAYS = 7

export function dueReminders(
  todayISO: string,
  ctx: { hasMonthlyCommitments: boolean; bigPayments: BigPayment[]; recipients: ReminderRecipient[] },
): DueReminder[] {
  const today = new Date(todayISO + 'T00:00:00Z')
  const isFirstOfMonth = today.getUTCDate() === 1
  const yearlyDue = ctx.bigPayments.some((p) => {
    const d = new Date(p.dateISO + 'T00:00:00Z')
    const diffDays = Math.round((d.getTime() - today.getTime()) / DAY)
    return diffDays >= 0 && diffDays <= YEARLY_WINDOW_DAYS
  })
  const out: DueReminder[] = []
  for (const r of ctx.recipients) {
    if (r.monthly && ctx.hasMonthlyCommitments && isFirstOfMonth) out.push({ userId: r.userId, kind: 'monthly' })
    if (r.yearly && yearlyDue) out.push({ userId: r.userId, kind: 'yearly' })
  }
  return out
}

export type CommitmentAsset = { assetId: string; householdId: string; amountCents: number }
export type ExistingCommitment = { assetId: string; dateISO: string }
export type CommitmentPost = { assetId: string; householdId: string; amountCents: number; dateISO: string }

/**
 * On the 1st of the month (UTC), return one monthly_commitment post per configured
 * property asset that does not already have a commitment dated in the current calendar
 * month. Month-level (not exact-date) idempotency: a commitment posted any day this
 * month suppresses the auto-post. Off the 1st, returns [].
 */
export function monthCommitmentPosts(
  todayISO: string,
  assets: CommitmentAsset[],
  existing: ExistingCommitment[],
): CommitmentPost[] {
  const today = new Date(todayISO + 'T00:00:00Z')
  if (today.getUTCDate() !== 1) return []
  const monthPrefix = todayISO.slice(0, 7) // "YYYY-MM"
  const already = new Set(
    existing.filter((e) => e.dateISO.slice(0, 7) === monthPrefix).map((e) => e.assetId),
  )
  return assets
    .filter((a) => a.amountCents > 0 && !already.has(a.assetId))
    .map((a) => ({
      assetId: a.assetId,
      householdId: a.householdId,
      amountCents: a.amountCents,
      dateISO: todayISO,
    }))
}
