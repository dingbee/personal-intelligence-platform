import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { revisePlanningIntelligence } from '@/modules/planning-intelligence/api/revisePlanningIntelligence'
import { useDefaultChatProviderId } from '@/modules/ai/providers/useDefaultChatProviderId'
import { useProviderChain } from '@/modules/ai/router/useProviderChain'
import { withProviderAvailability } from '@/modules/ai/orchestration/withProviderAvailability'
import type { Plan } from '@/modules/planning-intelligence/plan'

/** Mutation wrapping revisePlanningIntelligence, mirroring usePlanningIntelligence.ts's own provider-chain/availability handling exactly. */
export function useRevisePlanningIntelligence(workspaceId: string | null) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const providerId = useDefaultChatProviderId()
  const chain = useProviderChain(providerId)

  return useMutation({
    mutationFn: ({ plan, change }: { plan: Plan; change: string }) =>
      withProviderAvailability(chain, () => revisePlanningIntelligence({ plan, change, userId: user!.id, workspaceId, chain }), { queryClient }),
  })
}
