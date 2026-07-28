import type { AIProviderDescriptor } from '@/modules/core/providers/types'
import { isProviderAvailable, type ProviderAvailability, type ProviderOverrides } from '@/modules/ai/providers/availability'

export interface ResolveProviderChainParams {
  /** The account's stored default, or a conversation's explicit provider_id — whichever the caller already resolved. Wins outright if it's still an eligible candidate. */
  preferredProviderId: string
  chatProviders: AIProviderDescriptor[]
  availability: ProviderAvailability | undefined
  overrides?: ProviderOverrides
  /** providerId -> health score (0-100), from the existing calculateProviderHealthScore — used only to order the *remaining* candidates, never to exclude the preferred one. Omit to leave remaining candidates in registry order. */
  healthScores?: Record<string, number>
}

/**
 * The one place "which provider(s) should this request try, in what order"
 * is decided — everything else (Manual vs. Automatic) falls out of this
 * single rule rather than needing a separate mode flag: if the preferred
 * provider is eligible, it's chain[0] (this is "Manual" — an explicit or
 * default choice is never second-guessed while it's actually usable); if
 * it isn't (or there's nothing preferred), the eligible remainder is
 * ordered by health score, which is "Automatic" — the same mechanism,
 * just with nothing preferred to defer to.
 *
 * Reuses isProviderAvailable (key present AND not overridden-off) as the
 * sole candidacy gate — no parallel eligibility check.
 */
export function resolveProviderChain(params: ResolveProviderChainParams): string[] {
  const { preferredProviderId, chatProviders, availability, overrides, healthScores } = params

  const eligibleIds = chatProviders
    .filter((provider) => provider.kind === 'chat' && provider.status === 'available')
    .filter((provider) => isProviderAvailable(provider.id, availability, overrides))
    .map((provider) => provider.id)

  if (eligibleIds.length === 0) return []

  const rest = eligibleIds.filter((id) => id !== preferredProviderId)
  const orderedRest = healthScores ? [...rest].sort((a, b) => (healthScores[b] ?? 0) - (healthScores[a] ?? 0)) : rest

  return eligibleIds.includes(preferredProviderId) ? [preferredProviderId, ...orderedRest] : orderedRest
}
