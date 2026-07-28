import { DEFAULT_CHAT_PROVIDER_ID } from '@/modules/ai/providers/registry'
import { isProviderAvailable, type ProviderAvailability } from '@/modules/ai/providers/availability'

/**
 * A user's persisted `profiles.default_chat_provider_id` wins when set and
 * currently available; otherwise falls back to the platform's hardcoded
 * DEFAULT_CHAT_PROVIDER_ID (Provider Registry -> Availability Resolver ->
 * this -> every call site that previously imported the constant directly).
 */
export function resolveDefaultChatProviderId(
  preferredProviderId: string | null | undefined,
  availability: ProviderAvailability | undefined,
): string {
  if (preferredProviderId && isProviderAvailable(preferredProviderId, availability)) {
    return preferredProviderId
  }
  return DEFAULT_CHAT_PROVIDER_ID
}
