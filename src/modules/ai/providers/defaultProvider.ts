import { DEFAULT_CHAT_PROVIDER_ID } from '@/modules/ai/providers/registry'
import { isProviderAvailable, type ProviderAvailability, type ProviderOverrides } from '@/modules/ai/providers/availability'

/**
 * A user's persisted `profiles.default_chat_provider_id` wins when set and
 * currently available and not runtime-disabled; otherwise falls back to the
 * platform's hardcoded DEFAULT_CHAT_PROVIDER_ID (Provider Registry ->
 * Availability Resolver -> this -> every call site that previously imported
 * the constant directly). Does not itself re-check the hardcoded fallback's
 * candidacy — picking a different provider when even the fallback is
 * disabled is fallback/routing logic, deliberately left for a later phase.
 */
export function resolveDefaultChatProviderId(
  preferredProviderId: string | null | undefined,
  availability: ProviderAvailability | undefined,
  overrides?: ProviderOverrides,
): string {
  if (preferredProviderId && isProviderAvailable(preferredProviderId, availability, overrides)) {
    return preferredProviderId
  }
  return DEFAULT_CHAT_PROVIDER_ID
}
