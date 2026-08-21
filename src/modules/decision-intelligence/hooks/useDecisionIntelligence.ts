import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { runDecisionIntelligence } from '@/modules/decision-intelligence/api/runDecisionIntelligence'
import { useDefaultChatProviderId } from '@/modules/ai/providers/useDefaultChatProviderId'
import { useProviderChain } from '@/modules/ai/router/useProviderChain'
import { withProviderAvailability } from '@/modules/ai/orchestration/withProviderAvailability'
import type { PlanDerivedDecisionContext } from '@/modules/decision-intelligence/api/adaptPlanForDecisionContext'

/** Mutation wrapping runDecisionIntelligence, mirroring usePlanningIntelligence's exact provider-chain/availability handling. Entitlement is enforced server-side inside runDecisionIntelligence (not here). */
export function useDecisionIntelligence(workspaceId: string | null) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const providerId = useDefaultChatProviderId()
  const chain = useProviderChain(providerId)

  return useMutation({
    mutationFn: ({
      question,
      objective,
      userConstraints,
      plan,
      documentId,
    }: {
      question: string
      objective?: string | null
      userConstraints?: string[]
      plan?: PlanDerivedDecisionContext | null
      documentId?: string | null
    }) => withProviderAvailability(chain, () => runDecisionIntelligence({ question, objective, userConstraints, plan, documentId, userId: user!.id, workspaceId, chain }), { queryClient }),
  })
}
