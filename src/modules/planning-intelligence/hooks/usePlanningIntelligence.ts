import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { runPlanningIntelligence } from '@/modules/planning-intelligence/api/runPlanningIntelligence'
import { useDefaultChatProviderId } from '@/modules/ai/providers/useDefaultChatProviderId'
import { useProviderChain } from '@/modules/ai/router/useProviderChain'
import { withProviderAvailability } from '@/modules/ai/orchestration/withProviderAvailability'

/**
 * Mutation wrapping runPlanningIntelligence, mirroring
 * useResearchInvestigation's exact provider-chain/availability handling.
 * Entitlement is enforced server-side inside runPlanningIntelligence (not
 * here) — any locked/upgrade UI state is a UX hint only.
 */
export function usePlanningIntelligence(workspaceId: string | null) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const providerId = useDefaultChatProviderId()
  const chain = useProviderChain(providerId)

  return useMutation({
    mutationFn: ({ objective, userConstraints }: { objective: string; userConstraints?: string[] }) =>
      withProviderAvailability(chain, () => runPlanningIntelligence({ objective, userConstraints, userId: user!.id, workspaceId, chain }), { queryClient }),
  })
}
