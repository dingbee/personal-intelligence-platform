import { useQuery } from '@tanstack/react-query'
import { useCurrentPlan } from '@/modules/plans/hooks/useCurrentPlan'
import { listPlanAiProviders, type PlanProviderAllocation } from '@/modules/ai/providers/api/planProviders'

/**
 * Phase 5A — the caller's own plan's allowed AI providers. `isLoading`
 * stays true until BOTH the plan and the allocation set have resolved, so
 * a consumer that fails closed on "still loading" (see useProviderChain)
 * never briefly treats an unresolved plan as "no restriction" — the
 * commercial control this exists to enforce (Free = exactly one provider)
 * would otherwise have a startup window where every provider is eligible.
 */
export function usePlanAllowedProviders() {
  const { data: plan, isLoading: planLoading } = useCurrentPlan()
  const query = useQuery<PlanProviderAllocation[]>({
    queryKey: ['plan-ai-providers', plan?.planId],
    queryFn: () => listPlanAiProviders(plan!.planId),
    enabled: Boolean(plan?.planId),
    staleTime: 5 * 60 * 1000,
  })
  return { ...query, isLoading: planLoading || query.isLoading }
}
