import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { runActionIntelligence } from '@/modules/action-intelligence/api/runActionIntelligence'
import { useDefaultChatProviderId } from '@/modules/ai/providers/useDefaultChatProviderId'
import { useProviderChain } from '@/modules/ai/router/useProviderChain'
import { withProviderAvailability } from '@/modules/ai/orchestration/withProviderAvailability'
import type { PlanDerivedActionContext } from '@/modules/action-intelligence/api/adaptPlanForActionContext'
import type { DecisionDerivedActionContext } from '@/modules/action-intelligence/api/adaptDecisionForActionContext'

/** Mutation wrapping runActionIntelligence, mirroring useDecisionIntelligence's exact provider-chain/availability handling. Entitlement is enforced server-side inside runActionIntelligence (not here). */
export function useActionIntelligence(workspaceId: string | null) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const providerId = useDefaultChatProviderId()
  const chain = useProviderChain(providerId)

  return useMutation({
    mutationFn: ({
      instruction,
      objective,
      userConstraints,
      planContext,
      decisionContext,
    }: {
      instruction?: string | null
      objective?: string | null
      userConstraints?: string[]
      planContext?: PlanDerivedActionContext | null
      decisionContext?: DecisionDerivedActionContext | null
    }) =>
      withProviderAvailability(chain, () => runActionIntelligence({ instruction, objective, userConstraints, planContext, decisionContext, userId: user!.id, workspaceId, chain }), { queryClient }),
  })
}
