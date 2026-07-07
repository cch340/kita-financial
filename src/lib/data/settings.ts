import { createClient } from '@/lib/supabase/server'
import { getMembership } from './household'
import type { SettingsData, MemberRow } from './settings-shared'

export async function getSettingsData(): Promise<SettingsData | null> {
  const m = await getMembership()
  if (!m) return null
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: memberRows } = await supabase
    .from('household_members')
    .select('member_code, role, profiles!inner(display_name)')
    .eq('household_id', m.householdId)

  const members: MemberRow[] = (memberRows ?? []).map((r) => {
    const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
    return {
      code: r.member_code as MemberRow['code'],
      displayName: p?.display_name ?? r.member_code,
      role: r.role as MemberRow['role'],
    }
  }).sort((a, b) => (a.role === 'owner' ? -1 : 1))

  const { data: rem } = await supabase
    .from('reminder_settings')
    .select('reminder_type, enabled')
    .eq('user_id', user.id)
  const remMap = new Map((rem ?? []).map((r) => [r.reminder_type, r.enabled]))

  const { count: subCount } = await supabase
    .from('push_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  return {
    members,
    language: m.language,
    reminders: {
      monthly: remMap.get('monthly_commitment') ?? true, // default ON
      yearly: remMap.get('yearly_big_payment') ?? true,   // default ON
    },
    pushSubscribed: (subCount ?? 0) > 0,
    tabOrder: m.tabOrder,
  }
}
