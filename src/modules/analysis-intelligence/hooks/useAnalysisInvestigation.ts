import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { runAnalysisInvestigation } from '@/modules/analysis-intelligence/api/runAnalysisInvestigation'
import { useDefaultChatProviderId } from '@/modules/ai/providers/useDefaultChatProviderId'
import { useProviderChain } from '@/modules/ai/router/useProviderChain'
import { withProviderAvailability } from '@/modules/ai/orchestration/withProviderAvailability'
import type { AnalysisInvestigation } from '@/modules/analysis-intelligence/analysisInvestigation'

/**
 * Analysis Intelligence — mutation wrapping runAnalysisInvestigation,
 * mirroring useDataIntelligenceQuery's exact provider-chain/
 * availability handling. Entitlement is enforced server-side inside
 * runAnalysisInvestigation (not here) — the panel's Free-tier locked
 * state is a UX hint only.
 *
 * `onStepComplete` is threaded straight through to
 * runAnalysisInvestigation — the caller (the panel) owns the React
 * state that turns those callbacks into visible, real progress, this
 * hook does no state management of its own beyond the mutation itself.
 */
export function useAnalysisInvestigation(datasetId: string, workspaceId: string | null) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const providerId = useDefaultChatProviderId()
  const chain = useProviderChain(providerId)

  return useMutation({
    mutationFn: ({ question, onStepComplete }: { question: string; onStepComplete?: (investigation: AnalysisInvestigation) => void }) =>
      withProviderAvailability(chain, () => runAnalysisInvestigation({ datasetId, question, userId: user!.id, workspaceId, chain, onStepComplete }), { queryClient }),
  })
}
