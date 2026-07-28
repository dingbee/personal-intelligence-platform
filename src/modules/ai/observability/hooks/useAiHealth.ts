import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { listAiRequestsSince } from '@/modules/ai/observability/api/aiRequests'
import { providerRegistry } from '@/modules/core/providers/registry'
import { useProviderAvailability } from '@/modules/ai/providers/useProviderAvailability'
import { isProviderAvailable } from '@/modules/ai/providers/availability'
import {
  calculateHealthTrend,
  computeCapabilityHealth,
  computeErrorIntelligence,
  computeProviderHealth,
  computeUsageOverview,
  findLastSuccess,
  type HealthTrend,
} from '@/modules/ai/observability/aiHealthAggregation'
import { calculateProviderHealthScore } from '@/modules/ai/observability/healthScore'

export type TimeRange = '24h' | '7d' | '30d'

export const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
]

const RANGE_MS: Record<TimeRange, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
}

// The fixed last-24h-vs-previous-24h trend comparison needs 48h of raw
// history regardless of which display range is selected, so the
// underlying fetch always covers at least that much — "Last 24 hours"
// still fetches 48h under the hood, then filters down for display.
const TREND_WINDOW_MS = 2 * 24 * 60 * 60 * 1000

/**
 * Composes the request-history window with the registry (source of truth
 * for which chat providers exist), the live availability check from
 * Phase 7C, and the pure aggregation/scoring functions — this hook is the
 * only place that wires all of it together; nothing here re-derives
 * provider lists or error categories independently.
 */
export function useAiHealth(timeRange: TimeRange = '7d') {
  const { user } = useAuth()

  const fetchSinceIso = useMemo(
    () => new Date(Date.now() - Math.max(RANGE_MS[timeRange], TREND_WINDOW_MS)).toISOString(),
    [timeRange],
  )
  const displaySinceMs = useMemo(() => Date.now() - RANGE_MS[timeRange], [timeRange])

  const query = useQuery({
    queryKey: ['ai-health', fetchSinceIso],
    queryFn: () => listAiRequestsSince(fetchSinceIso),
    enabled: Boolean(user),
  })

  const { data: availability } = useProviderAvailability()
  const chatProviders = useMemo(() => providerRegistry.list().filter((provider) => provider.kind === 'chat'), [])

  const allFetchedRequests = useMemo(() => query.data ?? [], [query.data])
  // "Current state" sections reflect only the selected display range;
  // the trend comparison below always uses the fuller fetched set
  // (>= 48h) regardless of what's selected here.
  const requests = useMemo(
    () => allFetchedRequests.filter((request) => new Date(request.created_at).getTime() >= displaySinceMs),
    [allFetchedRequests, displaySinceMs],
  )

  const providerHealth = useMemo(
    () =>
      computeProviderHealth(requests, chatProviders).map((stats) => {
        const isAvailable = isProviderAvailable(stats.providerId, availability)
        const healthScore = calculateProviderHealthScore({
          isAvailable,
          requestCount: stats.requestCount,
          successRate: stats.successRate,
          avgLatencyMs: stats.avgLatencyMs,
          lastFailure: stats.lastFailure,
        })
        return { ...stats, isAvailable, healthScore }
      }),
    [requests, chatProviders, availability],
  )
  const capabilityHealth = useMemo(() => computeCapabilityHealth(requests), [requests])
  const errorIntelligence = useMemo(() => computeErrorIntelligence(requests), [requests])
  const usageOverview = useMemo(
    () => computeUsageOverview(requests, chatProviders, availability),
    [requests, chatProviders, availability],
  )
  const lastSuccess = useMemo(() => findLastSuccess(allFetchedRequests), [allFetchedRequests])
  const overallTrend = useMemo(() => calculateHealthTrend(allFetchedRequests), [allFetchedRequests])
  const providerTrends = useMemo(() => {
    const map = new Map<string, HealthTrend>()
    for (const provider of chatProviders) {
      map.set(provider.id, calculateHealthTrend(allFetchedRequests, provider.id))
    }
    return map
  }, [allFetchedRequests, chatProviders])

  return {
    providerHealth,
    capabilityHealth,
    errorIntelligence,
    usageOverview,
    lastSuccess,
    overallTrend,
    providerTrends,
    /** Display-range-filtered requests — e.g. for a provider detail page's "recent activity" list. */
    requests,
    isLoading: query.isLoading,
    isError: query.isError,
  }
}
