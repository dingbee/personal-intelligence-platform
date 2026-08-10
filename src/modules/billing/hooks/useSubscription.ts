import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { getCurrentUserSubscription } from '@/modules/billing/api/billing'

/**
 * Phase 4 Commercial Architecture — the caller's own billing/subscription
 * record, for the Settings billing section and payment-failure banners.
 * `data` is `null` for a user with no billing relationship (Free, or a
 * plan assigned manually by an admin rather than through a payment
 * provider) — that's a normal state the UI must render plainly, not an
 * error.
 */
export function useSubscription() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: () => getCurrentUserSubscription(user!.id),
    enabled: Boolean(user),
    staleTime: 60 * 1000,
  })
}
