import { useProfile } from '@/modules/settings/hooks/useProfile'
import { useProviderAvailability } from '@/modules/ai/providers/useProviderAvailability'
import { useProviderOverrides } from '@/modules/ai/providers/useProviderOverrides'
import { resolveDefaultChatProviderId } from '@/modules/ai/providers/defaultProvider'

/** The provider id every "use the default" call site should reach for — see resolveDefaultChatProviderId for the fallback rule. */
export function useDefaultChatProviderId(): string {
  const { data: profile } = useProfile()
  const { data: availability } = useProviderAvailability()
  const { data: overrides } = useProviderOverrides()
  return resolveDefaultChatProviderId(profile?.default_chat_provider_id, availability, overrides)
}
