import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { getStorageUsage } from '@/modules/plans/api/plans'

/**
 * Phase 4 Commercial Architecture — current storage usage/limit for usage
 * indicators (Settings billing section, upload surfaces). The database
 * trigger `enforce_storage_quota()` is the actual enforcement boundary
 * (server-authoritative, cannot be bypassed client-side); this hook is
 * read-only display data resolved through the same RPCs the trigger itself
 * uses, so the number shown always matches what the server would enforce.
 */
export function useStorageUsage() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['storage-usage', user?.id],
    queryFn: () => getStorageUsage(user!.id),
    enabled: Boolean(user),
    staleTime: 60 * 1000,
  })
}
