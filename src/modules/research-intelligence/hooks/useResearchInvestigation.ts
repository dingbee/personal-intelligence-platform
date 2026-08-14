import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { runResearchInvestigation } from '@/modules/research-intelligence/api/runResearchInvestigation'
import { useDefaultChatProviderId } from '@/modules/ai/providers/useDefaultChatProviderId'
import { useProviderChain } from '@/modules/ai/router/useProviderChain'
import { withProviderAvailability } from '@/modules/ai/orchestration/withProviderAvailability'
import type { ResearchInvestigation } from '@/modules/research-intelligence/researchInvestigation'

/**
 * Research Intelligence — mutation wrapping runResearchInvestigation,
 * mirroring useAnalysisInvestigation's exact provider-chain/availability
 * handling. Entitlement is enforced server-side inside
 * runResearchInvestigation (not here) — any locked/upgrade UI state is a
 * UX hint only.
 */
export function useResearchInvestigation(workspaceId: string | null) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const providerId = useDefaultChatProviderId()
  const chain = useProviderChain(providerId)

  return useMutation({
    mutationFn: ({
      question,
      scope,
      context,
      documentId,
      onStepComplete,
    }: {
      question: string
      scope?: string | null
      context?: string | null
      documentId?: string | null
      onStepComplete?: (investigation: ResearchInvestigation) => void
    }) =>
      withProviderAvailability(chain, () => runResearchInvestigation({ question, scope, context, documentId, userId: user!.id, workspaceId, chain, onStepComplete }), { queryClient }),
  })
}
