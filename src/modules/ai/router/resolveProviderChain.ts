import type { AIProviderDescriptor } from '@/modules/core/providers/types'
import { isProviderAvailable, type ProviderAvailability, type ProviderOverrides } from '@/modules/ai/providers/availability'

export interface PlatformProviderRouting {
  enabled: boolean
  priority: number
}

export interface ResolveProviderChainParams {
  /** The account's stored default, or a conversation's explicit provider_id — whichever the caller already resolved. Wins outright if it's still an eligible candidate. Null/undefined means no preference at all ("Auto") — the eligible set is then ordered purely by platform priority/health score, with no candidate treated as preferred. */
  preferredProviderId: string | null | undefined
  chatProviders: AIProviderDescriptor[]
  availability: ProviderAvailability | undefined
  overrides?: ProviderOverrides
  /** providerId -> health score (0-100), from the existing calculateProviderHealthScore — used only to order the *remaining* candidates, never to exclude the preferred one. Omit to leave remaining candidates in registry order. */
  healthScores?: Record<string, number>
  /**
   * Founder Command Center — platform-wide governance
   * (0036_founder_command_center.sql), keyed by provider id. Unlike a
   * per-user override, `enabled: false` here is absolute: it removes a
   * provider from the eligible set entirely, even if it's the caller's
   * own preferred/default provider — a founder disabling a provider
   * platform-wide must actually stop it from being used. `priority`
   * (higher first) orders the non-preferred remainder ahead of
   * `healthScores`, which only breaks ties. Omit entirely to leave
   * existing behavior (health-score-only ordering, no platform
   * exclusion) completely unchanged — purely additive.
   */
  platformSettings?: Record<string, PlatformProviderRouting>
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
  const { preferredProviderId, chatProviders, availability, overrides, healthScores, platformSettings } = params

  const eligibleIds = chatProviders
    .filter((provider) => provider.kind === 'chat' && provider.status === 'available')
    .filter((provider) => isProviderAvailable(provider.id, availability, overrides))
    .filter((provider) => platformSettings?.[provider.id]?.enabled !== false)
    .map((provider) => provider.id)

  if (eligibleIds.length === 0) return []

  const rest = eligibleIds.filter((id) => id !== preferredProviderId)
  const orderedRest =
    healthScores || platformSettings
      ? [...rest].sort((a, b) => {
          const priorityDiff = (platformSettings?.[b]?.priority ?? 0) - (platformSettings?.[a]?.priority ?? 0)
          return priorityDiff !== 0 ? priorityDiff : (healthScores?.[b] ?? 0) - (healthScores?.[a] ?? 0)
        })
      : rest

  return preferredProviderId && eligibleIds.includes(preferredProviderId) ? [preferredProviderId, ...orderedRest] : orderedRest
}
