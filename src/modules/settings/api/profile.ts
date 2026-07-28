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
