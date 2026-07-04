'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMembership } from '@/lib/data/household'
import { isValidEmail } from '@/lib/data/settings-shared'

export async function updateLanguage(lang: 'en' | 'zh'): Promise<{ ok: boolean; error?: string }> {
  if (lang !== 'en' && lang !== 'zh') return { ok: false, error: 'save_failed' }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'not_authenticated' }
  const { error } = await supabase.from('profiles').update({ language: lang }).eq('id', user.id)
  if (error) { console.error('updateLanguage:', error.message); return { ok: false, error: 'save_failed' } }
  revalidatePath('/', 'layout') // re-seed LocaleProvider app-wide
  return { ok: true }
}

export async function updateReminderSetting(
  type: 'monthly_commitment' | 'yearly_big_payment',
  enabled: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'not_authenticated' }
  const { error } = await supabase
    .from('reminder_settings')
    .upsert({ user_id: user.id, reminder_type: type, enabled }, { onConflict: 'user_id,reminder_type' })
  if (error) { console.error('updateReminderSetting:', error.message); return { ok: false, error: 'save_failed' } }
  return { ok: true }
}

// Lightweight invite: add an EXISTING Kita account (profile) to this household.
// No new tables, no email delivery. Service-role bypasses the SELECT-only RLS
// on household_members. Assigns the JC member slot if free.
export async function inviteMember(email: string): Promise<{ ok: boolean; error?: string }> {
  const clean = email.trim().toLowerCase()
  if (!isValidEmail(clean)) return { ok: false, error: 'invalid_email' }
  const m = await getMembership()
  if (!m) return { ok: false, error: 'not_authenticated' }

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('id').eq('email', clean).maybeSingle()
  if (!profile) return { ok: false, error: 'invite_not_found' }

  const { data: existing } = await admin
    .from('household_members').select('household_id, member_code').eq('user_id', profile.id).maybeSingle()
  if (existing?.household_id === m.householdId) return { ok: false, error: 'invite_already_member' }
  if (existing) return { ok: false, error: 'invite_already_member' } // already in another household

  const { data: taken } = await admin
    .from('household_members').select('member_code').eq('household_id', m.householdId)
  const used = new Set((taken ?? []).map((r) => r.member_code))
  const slot = ['JC', 'CH'].find((c) => !used.has(c))
  if (!slot) return { ok: false, error: 'invite_failed' } // household full (2 members)

  const { error } = await admin.from('household_members').insert({
    household_id: m.householdId, user_id: profile.id, role: 'member', member_code: slot,
  })
  if (error) { console.error('inviteMember:', error.message); return { ok: false, error: 'invite_failed' } }
  revalidatePath('/settings')
  return { ok: true }
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
