import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { getProviderAvailability } from '@/modules/ai/providers/availability'

export function useProviderAvailability() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['provider-availability'],
    queryFn: getProviderAvailability,
    // API key configuration doesn't change mid-session in the normal case;
    // avoid re-checking on every window focus. Still refetchable on demand
    // (see useSendMessage, which invalidates this after a key-missing send
    // failure so the selector stops offering that provider).
    staleTime: 5 * 60 * 1000,
    enabled: Boolean(user),
  })
}
