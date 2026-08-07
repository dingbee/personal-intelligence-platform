import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { getCurrentUserPlan } from '@/modules/plans/api/plans'

export function useCurrentPlan() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['current-plan', user?.id],
    queryFn: () => getCurrentUserPlan(user!.id),
    enabled: Boolean(user),
    staleTime: 5 * 60 * 1000,
  })
}
