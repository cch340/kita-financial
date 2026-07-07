import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Membership } from './types'
import { parseLayout } from '@/lib/nav/nav-shared'

export const getMembership = cache(async (): Promise<Membership | null> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase
    .from('household_members')
    .select('household_id, member_code, profiles!inner(display_name, language, tab_order)')
    .eq('user_id', user.id)
    .single()
  if (error || !data) return null
  const profile = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles
  return {
    householdId: data.household_id,
    memberCode: data.member_code as Membership['memberCode'],
    language: (profile?.language ?? 'en') as Membership['language'],
    displayName: profile?.display_name ?? data.member_code,
    tabOrder: parseLayout(profile?.tab_order),
  }
})
