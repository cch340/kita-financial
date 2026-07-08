import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToUser } from '@/lib/push/web-push'
import { t } from '@/i18n'
import {
  dueReminders,
  monthCommitmentPosts,
  type ReminderRecipient,
  type BigPayment,
  type CommitmentAsset,
  type ExistingCommitment,
} from './reminders-shared'

export async function runReminderScan(todayISO: string): Promise<{ sent: number; posted: number }> {
  const admin = createAdminClient()

  // recipients: every profile + its reminder settings (default ON when no row)
  // The cron runs unattended — a silent query failure would degrade to "nothing
  // due" with no signal, so surface any error in the logs.
  const { data: profiles, error: profilesErr } = await admin.from('profiles').select('id, language')
  const { data: settings, error: settingsErr } = await admin
    .from('reminder_settings').select('user_id, reminder_type, enabled')
  if (profilesErr) console.error('runReminderScan profiles:', profilesErr.message)
  if (settingsErr) console.error('runReminderScan reminder_settings:', settingsErr.message)
  const enabledMap = new Map<string, boolean>()
  for (const s of settings ?? []) enabledMap.set(`${s.user_id}:${s.reminder_type}`, s.enabled)
  const recipients: ReminderRecipient[] = (profiles ?? []).map((p) => ({
    userId: p.id,
    language: (p.language ?? 'en') as 'en' | 'zh',
    monthly: enabledMap.get(`${p.id}:monthly_commitment`) ?? true,
    yearly: enabledMap.get(`${p.id}:yearly_big_payment`) ?? true,
  }))

  const { count: commitCount, error: commitErr } = await admin
    .from('monthly_commitments').select('id', { count: 'exact', head: true })
  if (commitErr) console.error('runReminderScan monthly_commitments:', commitErr.message)
  const hasMonthlyCommitments = (commitCount ?? 0) > 0

  const horizon = new Date(new Date(todayISO + 'T00:00:00Z').getTime() + 8 * 86_400_000)
  const { data: txns, error: txnsErr } = await admin
    .from('asset_transactions')
    .select('date')
    .eq('settled', false)
    .in('txn_type', ['road_tax_insurance', 'scheduled_payment'])
    .gte('date', todayISO)
    .lte('date', horizon.toISOString().slice(0, 10))
  if (txnsErr) console.error('runReminderScan asset_transactions:', txnsErr.message)
  const bigPayments: BigPayment[] = (txns ?? []).map((r) => ({ dateISO: r.date as string }))

  const due = dueReminders(todayISO, { hasMonthlyCommitments, bigPayments, recipients })
  const langByUser = new Map(recipients.map((r) => [r.userId, r.language]))

  let sent = 0
  for (const d of due) {
    const lang = langByUser.get(d.userId) ?? 'en'
    const payload = d.kind === 'monthly'
      ? { title: t(lang, 'push.monthly.title'), body: t(lang, 'push.monthly.body'), url: '/assets' }
      : { title: t(lang, 'push.yearly.title'), body: t(lang, 'push.yearly.body'), url: '/assets' }
    sent += await sendPushToUser(d.userId, payload)
  }

  // --- Auto-post recurring monthly commitments (property assets) ---
  // On the 1st, insert the "Monthly Commitment" inflow for each property asset that has
  // metadata.monthlyCommitmentCents set, unless one already exists this calendar month.
  // Idempotent: the cron may re-run the same day; existing rows suppress re-posting.
  let posted = 0
  const { data: propAssets, error: assetsErr } = await admin
    .from('assets')
    .select('id, household_id, metadata')
    .eq('type', 'property')
    .eq('status', 'active')
  if (assetsErr) console.error('runReminderScan assets:', assetsErr.message)

  const commitmentAssets: CommitmentAsset[] = (propAssets ?? [])
    .map((a) => {
      const md = (a.metadata ?? {}) as Record<string, unknown>
      const cents = md.monthlyCommitmentCents
      return {
        assetId: a.id as string,
        householdId: a.household_id as string,
        amountCents: typeof cents === 'number' ? cents : 0,
      }
    })
    .filter((a) => a.amountCents > 0)

  if (commitmentAssets.length > 0) {
    // Bound the month as [firstOfThisMonth, firstOfNextMonth). We avoid a literal upper
    // bound like `${monthPrefix}-31` because Postgres rejects invalid date literals
    // (e.g. '2026-02-31'), which would error the whole query and break idempotency.
    const firstOfThisMonth = todayISO.slice(0, 7) + '-01'
    const startOfMonth = new Date(firstOfThisMonth + 'T00:00:00Z')
    const firstOfNextMonth = new Date(
      Date.UTC(startOfMonth.getUTCFullYear(), startOfMonth.getUTCMonth() + 1, 1),
    ).toISOString().slice(0, 10)

    const { data: existingTxns, error: existErr } = await admin
      .from('asset_transactions')
      .select('asset_id, date')
      .eq('txn_type', 'monthly_commitment')
      .gte('date', firstOfThisMonth)
      .lt('date', firstOfNextMonth)
    if (existErr) {
      // Fail-safe: if we cannot verify which commitments were already posted this
      // month, skip posting entirely rather than risk double-posting. Return the
      // current tallies with `posted` unchanged.
      console.error('runReminderScan commitment txns:', existErr.message)
      return { sent, posted }
    }
    const existing: ExistingCommitment[] = (existingTxns ?? []).map((r) => ({
      assetId: r.asset_id as string,
      dateISO: r.date as string,
    }))

    const toPost = monthCommitmentPosts(todayISO, commitmentAssets, existing)
    for (const p of toPost) {
      const { error: insErr } = await admin.from('asset_transactions').insert({
        asset_id: p.assetId,
        household_id: p.householdId,
        date: p.dateISO,
        description: 'Monthly Commitment',
        amount_cents: p.amountCents,
        direction: 'in',
        txn_type: 'monthly_commitment',
        settled: false,
      })
      if (insErr) { console.error('runReminderScan post commitment:', insErr.message); continue }
      posted++
    }
  }

  return { sent, posted }
}
