import { supabase } from '@/shared/lib/supabase'
import type { PlatformProviderSetting } from '@/shared/types/database'

/** RLS: authenticated-read-all (0036_founder_command_center.sql) — every signed-in user's client reads this to fold platform-wide governance into resolveProviderChain; only admin_set_platform_provider_setting can write it. */
export async function listPlatformProviderSettings(): Promise<PlatformProviderSetting[]> {
  const { data, error } = await supabase.from('platform_provider_settings').select('*')
  if (error) throw error
  return data
}
