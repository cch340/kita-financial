import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToUser } from '@/lib/push/web-push'
import { t } from '@/i18n'
import { dueReminders, type ReminderRecipient, type BigPayment } from './reminders-shared'

export async function runReminderScan(todayISO: string): Promise<{ sent: number }> {
  const admin = createAdminClient()

  // recipients: every profile + its reminder settings (default ON when no row)
  const { data: profiles } = await admin.from('profiles').select('id, language')
  const { data: settings } = await admin.from('reminder_settings').select('user_id, reminder_type, enabled')
  const enabledMap = new Map<string, boolean>()
  for (const s of settings ?? []) enabledMap.set(`${s.user_id}:${s.reminder_type}`, s.enabled)
  const recipients: ReminderRecipient[] = (profiles ?? []).map((p) => ({
    userId: p.id,
    language: (p.language ?? 'en') as 'en' | 'zh',
    monthly: enabledMap.get(`${p.id}:monthly_commitment`) ?? true,
    yearly: enabledMap.get(`${p.id}:yearly_big_payment`) ?? true,
  }))

  const { count: commitCount } = await admin
    .from('monthly_commitments').select('id', { count: 'exact', head: true })
  const hasMonthlyCommitments = (commitCount ?? 0) > 0

  const horizon = new Date(new Date(todayISO + 'T00:00:00Z').getTime() + 8 * 86_400_000)
  const { data: txns } = await admin
    .from('asset_transactions')
    .select('date')
    .eq('settled', false)
    .in('txn_type', ['road_tax_insurance', 'scheduled_payment'])
    .gte('date', todayISO)
    .lte('date', horizon.toISOString().slice(0, 10))
  const bigPayments: BigPayment[] = (txns ?? []).map((r) => ({ dateISO: r.date as string }))

  const due = dueReminders(todayISO, { hasMonthlyCommitments, bigPayments, recipients })
  const langByUser = new Map(recipients.map((r) => [r.userId, r.language]))

  let sent = 0
  for (const d of due) {
    const lang = langByUser.get(d.userId) ?? 'en'
    const payload = d.kind === 'monthly'
      ? { title: t(lang, 'push.monthly.title'), body: t(lang, 'push.monthly.body'), url: '/budget' }
      : { title: t(lang, 'push.yearly.title'), body: t(lang, 'push.yearly.body'), url: '/assets' }
    sent += await sendPushToUser(d.userId, payload)
  }
  return { sent }
}
