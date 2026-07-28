import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import {
  listProviderOverrides,
  setProviderOverride,
  type ProviderOverrideRow,
} from '@/modules/ai/providers/api/providerOverrides'
import type { ProviderOverrides } from '@/modules/ai/providers/availability'

function toOverrideMap(rows: ProviderOverrideRow[]): ProviderOverrides {
  return Object.fromEntries(rows.map((row) => [row.provider_id, row.enabled]))
}

/** Raw rows, for UI that needs `reason`/`updated_at` alongside the enabled state. */
export function useProviderOverrideRows() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['provider-overrides', user?.id],
    queryFn: () => listProviderOverrides(user!.id),
    // Mirrors useProviderAvailability's staleTime — this doesn't change
    // mid-session in the normal case, and the mutation below invalidates
    // it explicitly whenever it actually does change.
    staleTime: 5 * 60 * 1000,
    enabled: Boolean(user),
  })
}

/** The gating-ready {providerId: enabled} map every resolver call site consumes — same cache entry as useProviderOverrideRows, just projected. */
export function useProviderOverrides() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['provider-overrides', user?.id],
    queryFn: () => listProviderOverrides(user!.id),
    select: toOverrideMap,
    staleTime: 5 * 60 * 1000,
    enabled: Boolean(user),
  })
}

export function useSetProviderOverride() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      providerId,
      enabled,
      reason = null,
    }: {
      providerId: string
      enabled: boolean | null
      reason?: string | null
    }) => setProviderOverride(user!.id, providerId, enabled, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-overrides', user?.id] })
    },
  })
}
