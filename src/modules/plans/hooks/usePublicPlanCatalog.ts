import { useQuery } from '@tanstack/react-query'
import { getPublicPlanCatalog } from '@/modules/plans/api/plans'

const PUBLIC_PLAN_CODES = ['free', 'student', 'pro', 'founding_pro']

/** Phase 5C — drives /pricing's plan comparison from live plan_quotas/plans data, never hardcoded copy. */
export function usePublicPlanCatalog() {
  return useQuery({
    queryKey: ['public-plan-catalog'],
    queryFn: () => getPublicPlanCatalog(PUBLIC_PLAN_CODES),
    staleTime: 5 * 60 * 1000,
  })
}
