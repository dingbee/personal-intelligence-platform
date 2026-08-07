import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { listPlatformProviderSettings } from '@/modules/ai/providers/api/platformProviderSettings'
import type { PlatformProviderRouting } from '@/modules/ai/router/resolveProviderChain'

/** Shaped exactly as resolveProviderChain's platformSettings param expects, so every consumer can spread the result straight in. */
export function usePlatformProviderSettings() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['platform-provider-settings'],
    queryFn: async () => {
      const rows = await listPlatformProviderSettings()
      return Object.fromEntries(
        rows.map((row) => [row.provider_id, { enabled: row.enabled, priority: row.priority } satisfies PlatformProviderRouting]),
      )
    },
    enabled: Boolean(user),
    staleTime: 60 * 1000,
  })
}
