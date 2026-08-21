import { supabase } from '@/shared/lib/supabase'
import type { Profile } from '@/shared/types/database'

export async function getProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
  if (error) throw error
  return data
}

export async function updateProfile(userId: string, displayName: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ display_name: displayName })
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error
  return data
}

/** `providerId: null` clears the override, falling back to the platform's hardcoded DEFAULT_CHAT_PROVIDER_ID. */
export async function updateDefaultChatProvider(userId: string, providerId: string | null): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ default_chat_provider_id: providerId })
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * First-Login Welcome Experience (0079_onboarding_state.sql) — marks
 * onboarding handled, whether the user finished the guided steps or
 * explicitly skipped; both are "never show this again," so there is
 * exactly one write path for both outcomes. Idempotent in effect (setting
 * it again just moves the timestamp forward), so callers don't need to
 * guard against calling this more than once.
 */
export async function completeOnboarding(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error
  return data
}
