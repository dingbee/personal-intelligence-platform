import { supabase } from '@/shared/lib/supabase'

export interface ProviderOverrideRow {
  id: string
  provider_id: string
  enabled: boolean | null
  reason: string | null
  updated_at: string
}

export async function listProviderOverrides(userId: string): Promise<ProviderOverrideRow[]> {
  const { data, error } = await supabase
    .from('provider_overrides')
    .select('id, provider_id, enabled, reason, updated_at')
    .eq('user_id', userId)
  if (error) throw error
  return data
}

/** `enabled: null` resets to "no override" — falls through to the availability-only gate. */
export async function setProviderOverride(
  userId: string,
  providerId: string,
  enabled: boolean | null,
  reason: string | null,
): Promise<ProviderOverrideRow> {
  const { data, error } = await supabase
    .from('provider_overrides')
    .upsert(
      { user_id: userId, provider_id: providerId, enabled, reason, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,provider_id' },
    )
    .select('id, provider_id, enabled, reason, updated_at')
    .single()
  if (error) throw error
  return data
}
