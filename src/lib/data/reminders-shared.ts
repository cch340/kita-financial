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
