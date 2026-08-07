import { isProviderAvailable, type ProviderAvailability, type ProviderOverrides } from '@/modules/ai/providers/availability'

/**
 * AI Preference Layer v1 — this used to substitute the hardcoded
 * DEFAULT_CHAT_PROVIDER_ID constant whenever the user had no eligible
 * preference, which silently defeated "Auto (Recommended)": every call
 * site downstream saw *some* concrete preferred id and never reached
 * resolveProviderChain's real automatic (health/priority-ordered)
 * ordering. "Users only express preference; NOVA decides execution" means
 * the absence of a preference has to actually reach the resolver as an
 * absence, not get papered over here. Returns the user's raw eligible
 * preference, or null — resolveProviderChain already treats a
 * non-matching/null preferredProviderId correctly (falls straight to the
 * health/priority-ordered eligible set), so no downstream fallback logic
 * needs to change.
 */
export function resolveDefaultChatProviderId(
  preferredProviderId: string | null | undefined,
  availability: ProviderAvailability | undefined,
  overrides?: ProviderOverrides,
): string | null {
  if (preferredProviderId && isProviderAvailable(preferredProviderId, availability, overrides)) {
    return preferredProviderId
  }
  return null
}
