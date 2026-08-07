import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { supabase } from '@/shared/lib/supabase'

/**
 * The client-side half of the admin check — is_platform_admin() (SQL,
 * SECURITY DEFINER) is the actual enforcement, called by every admin RPC
 * internally regardless of what this hook returns. This hook only
 * decides what the UI shows (the /admin nav link, RequireAdmin's
 * redirect) — never trust it as the reason an admin_* RPC succeeded.
 */
export function usePlatformAdmin() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['is-platform-admin', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('is_platform_admin')
      if (error) throw error
      return data
    },
    enabled: Boolean(user),
    staleTime: 5 * 60 * 1000,
  })
}
