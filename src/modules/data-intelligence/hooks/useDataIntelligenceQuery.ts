import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { runDataIntelligenceQuery } from '@/modules/data-intelligence/api/runDataIntelligenceQuery'
import { useDefaultChatProviderId } from '@/modules/ai/providers/useDefaultChatProviderId'
import { useProviderChain } from '@/modules/ai/router/useProviderChain'
import { withProviderAvailability } from '@/modules/ai/orchestration/withProviderAvailability'

/**
 * Data Intelligence Foundation — mutation wrapping runDataIntelligenceQuery,
 * mirroring useGenerateWorkspaceBriefing's exact provider-chain/
 * availability handling. Entitlement is enforced server-side inside
 * runDataIntelligenceQuery/runCapability (not here) — this hook does no
 * plan check of its own; the panel's Free-tier locked state
 * (DataIntelligenceQueryPanel) is a UX hint only.
 */
export function useDataIntelligenceQuery(datasetId: string, workspaceId: string | null) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const providerId = useDefaultChatProviderId()
  const chain = useProviderChain(providerId)

  return useMutation({
    mutationFn: (question: string) =>
      withProviderAvailability(chain, () => runDataIntelligenceQuery({ datasetId, question, userId: user!.id, workspaceId, chain }), { queryClient }),
  })
}
