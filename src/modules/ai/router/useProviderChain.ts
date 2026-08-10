import { useMemo } from 'react'
import { providerRegistry } from '@/modules/core/providers/registry'
import { useProviderAvailability } from '@/modules/ai/providers/useProviderAvailability'
import { useProviderOverrides } from '@/modules/ai/providers/useProviderOverrides'
import { usePlatformProviderSettings } from '@/modules/ai/providers/usePlatformProviderSettings'
import { usePlanAllowedProviders } from '@/modules/ai/providers/usePlanAllowedProviders'
import { useAiHealth } from '@/modules/ai/observability/hooks/useAiHealth'
import { resolveProviderChain } from '@/modules/ai/router/resolveProviderChain'

/**
 * The ordered candidate list every execution entry point (AIService.sendMessage,
 * the capability hooks via runWithFallback) consumes. Composes existing,
 * already-cached queries — useProviderAvailability, useProviderOverrides,
 * useAiHealth's provider scoring, usePlatformProviderSettings (Founder Command
 * Center governance) — with zero new network calls beyond the one settings
 * read: useAiHealth('7d') shares its query-cache entry with every other
 * consumer already calling it (Settings' useProviderIntelligence, the AI
 * Health dashboard).
 */
export function useProviderChain(preferredProviderId: string | null, options: { requireVision?: boolean } = {}): string[] {
  const { requireVision } = options
  const chatProviders = useMemo(() => providerRegistry.list().filter((provider) => provider.kind === 'chat'), [])
  const { data: availability } = useProviderAvailability()
  const { data: overrides } = useProviderOverrides()
  const { data: platformSettings } = usePlatformProviderSettings()
  const { providerHealth } = useAiHealth('7d')
  // Phase 5A — commercial control: which providers a request may even
  // consider is now plan-governed (Free = exactly one, Pro/Founding Pro =
  // multiple). `[]` while loading, never `undefined`, so an unresolved
  // plan can never be mistaken for "no restriction" — see
  // usePlanAllowedProviders' own doc comment.
  const { data: planProviders = [], isLoading: planProvidersLoading } = usePlanAllowedProviders()

  return useMemo(() => {
    if (planProvidersLoading) return []
    const healthScores = Object.fromEntries(providerHealth.map((entry) => [entry.providerId, entry.healthScore]))
    const planAllowedProviderIds = planProviders.map((p) => p.providerId)
    const planProviderPriority = Object.fromEntries(planProviders.map((p) => [p.providerId, p.priority]))
    return resolveProviderChain({
      preferredProviderId,
      chatProviders,
      availability,
      overrides,
      healthScores,
      platformSettings,
      requireVision,
      planAllowedProviderIds,
      planProviderPriority,
    })
  }, [preferredProviderId, chatProviders, availability, overrides, providerHealth, platformSettings, requireVision, planProviders, planProvidersLoading])
}
