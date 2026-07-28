import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { listAiRequestsSince } from '@/modules/ai/observability/api/aiRequests'
import { providerRegistry } from '@/modules/core/providers/registry'
import { useProviderAvailability } from '@/modules/ai/providers/useProviderAvailability'
import { isProviderAvailable } from '@/modules/ai/providers/availability'
import {
  computeCapabilityHealth,
  computeErrorIntelligence,
  computeProviderHealth,
} from '@/modules/ai/observability/aiHealthAggregation'

const WINDOW_DAYS = 7

/**
 * Composes the request-history window with the registry (source of truth
 * for which chat providers exist) and the live availability check from
 * Phase 7C, so a provider's dashboard row reflects both its history and
 * whether it's usable right now — without re-deriving availability from
 * request history, which would just be a stale proxy for the real thing.
 */
export function useAiHealth() {
  const { user } = useAuth()
  const sinceIso = useMemo(() => new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString(), [])

  const query = useQuery({
    queryKey: ['ai-health', sinceIso],
    queryFn: () => listAiRequestsSince(sinceIso),
    enabled: Boolean(user),
  })

  const { data: availability } = useProviderAvailability()
  const chatProviders = useMemo(() => providerRegistry.list().filter((provider) => provider.kind === 'chat'), [])

  const requests = useMemo(() => query.data ?? [], [query.data])
  const providerHealth = useMemo(
    () =>
      computeProviderHealth(requests, chatProviders).map((stats) => ({
        ...stats,
        isAvailable: isProviderAvailable(stats.providerId, availability),
      })),
    [requests, chatProviders, availability],
  )
  const capabilityHealth = useMemo(() => computeCapabilityHealth(requests), [requests])
  const errorIntelligence = useMemo(() => computeErrorIntelligence(requests), [requests])

  return {
    providerHealth,
    capabilityHealth,
    errorIntelligence,
    windowDays: WINDOW_DAYS,
    isLoading: query.isLoading,
    isError: query.isError,
  }
}
