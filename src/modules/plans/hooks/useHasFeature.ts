import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { hasFeature } from '@/modules/plans/api/plans'

/**
 * Phase 4 Commercial Architecture — centralized feature-entitlement check
 * for UI gating (e.g. hiding the invite form for a Free user, in favor of
 * an upgrade prompt). This is a UX hint only: `invite_to_workspace`
 * independently re-resolves the same `has_feature('collaboration')` check
 * server-side and is the actual enforcement boundary, so a stale/optimistic
 * client read here can never grant access it shouldn't.
 */
export function useHasFeature(featureKey: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['has-feature', user?.id, featureKey],
    queryFn: () => hasFeature(user!.id, featureKey),
    enabled: Boolean(user),
    staleTime: 5 * 60 * 1000,
  })
}
