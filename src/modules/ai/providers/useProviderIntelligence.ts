import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { providerRegistry } from '@/modules/core/providers/registry'
import { useProviderAvailability } from '@/modules/ai/providers/useProviderAvailability'
import { useProviderOverrideRows, useSetProviderOverride } from '@/modules/ai/providers/useProviderOverrides'
import { isProviderAvailable } from '@/modules/ai/providers/availability'
import { useAiHealth } from '@/modules/ai/observability/hooks/useAiHealth'
import { listRecentProviderTests } from '@/modules/ai/observability/api/aiRequests'
import { runProviderTest } from '@/modules/ai/providers/api/providerTest'
import type { AiRequest } from '@/shared/types/database'

export interface ProviderLastTest {
  success: boolean
  at: string
  message?: string
}

export interface ProviderIntelligence {
  id: string
  label: string
  models: string[]
  /** Registered with a real adapter at all — 'planned' providers (ollama, ...) are never operational. */
  wiredUp: boolean
  keyAvailable: boolean
  enabled: boolean
  healthScore: number
  requestCount: number
  lastTest: ProviderLastTest | null
  lastFailure: { at: string; message: string } | null
}

/**
 * The single composition point the Control Center UI reads from — combines
 * providerRegistry (static), availability (key presence), provider_overrides
 * (enabled/disabled), useAiHealth's provider scoring (unchanged, reused as-
 * is), and manual-test history into one view-model per provider. No new
 * provider system: every input here is an existing source of truth, this
 * just merges them so the UI doesn't query five things separately.
 */
export function useProviderIntelligence() {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()
  const queryClient = useQueryClient()

  const chatProviders = useMemo(() => providerRegistry.list().filter((provider) => provider.kind === 'chat'), [])
  const { data: availability } = useProviderAvailability()
  const { data: overrideRows = [] } = useProviderOverrideRows()
  const { providerHealth } = useAiHealth('7d')

  const testHistory = useQuery({
    queryKey: ['provider-test-history'],
    queryFn: () => listRecentProviderTests(),
    staleTime: 60 * 1000,
    enabled: Boolean(user),
  })

  const overrideByProviderId = useMemo(
    () => Object.fromEntries(overrideRows.map((row) => [row.provider_id, row])),
    [overrideRows],
  )

  const lastTestByProviderId = useMemo(() => {
    const map = new Map<string, AiRequest>()
    for (const request of testHistory.data ?? []) {
      if (!map.has(request.provider)) map.set(request.provider, request)
    }
    return map
  }, [testHistory.data])

  const providers: ProviderIntelligence[] = useMemo(
    () =>
      chatProviders.map((provider) => {
        const wiredUp = provider.status === 'available'
        const keyAvailable = wiredUp && isProviderAvailable(provider.id, availability)
        const override = overrideByProviderId[provider.id]
        const health = providerHealth.find((entry) => entry.providerId === provider.id)
        const lastTestRequest = lastTestByProviderId.get(provider.id)

        return {
          id: provider.id,
          label: provider.label,
          models: provider.models ?? [],
          wiredUp,
          keyAvailable,
          enabled: override?.enabled !== false,
          healthScore: health?.healthScore ?? 0,
          requestCount: health?.requestCount ?? 0,
          lastTest: lastTestRequest
            ? {
                success: lastTestRequest.status === 'success',
                at: lastTestRequest.created_at,
                message: lastTestRequest.error_message ?? undefined,
              }
            : null,
          lastFailure: health?.lastFailure ? { at: health.lastFailure.at, message: health.lastFailure.message } : null,
        }
      }),
    [chatProviders, availability, overrideByProviderId, providerHealth, lastTestByProviderId],
  )

  const setOverride = useSetProviderOverride()

  const testProvider = useMutation({
    mutationFn: (providerId: string) => runProviderTest(providerId, user!.id, currentWorkspaceId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['provider-test-history'] })
    },
  })

  return {
    providers,
    plannedProviders: chatProviders.filter((provider) => provider.status !== 'available'),
    setOverride,
    testProvider,
    isLoading: testHistory.isLoading,
  }
}
