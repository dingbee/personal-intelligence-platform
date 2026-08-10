import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { useCommandContext } from '@/modules/commands/hooks/useCommandContext'
import { generateWorkspaceBriefing } from '@/modules/workspace-intelligence/api/generateWorkspaceBriefing'
import { useDefaultChatProviderId } from '@/modules/ai/providers/useDefaultChatProviderId'
import { useProviderChain } from '@/modules/ai/router/useProviderChain'
import { withProviderAvailability } from '@/modules/ai/orchestration/withProviderAvailability'

/**
 * Phase P1 Advanced AI Workspace — the mutation wrapping
 * generateWorkspaceBriefing, mirroring useGenerateBriefing's exact
 * provider-chain/availability handling. Entitlement (Free vs Pro/
 * Founding Pro) is enforced server-side inside runCapability (Phase P0)
 * — this hook does no plan check of its own; the UI's Free-tier locked
 * state (WorkspaceBriefingCard) is a UX hint only, same convention as
 * every other useHasFeature call site.
 */
export function useGenerateWorkspaceBriefing() {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()
  const commandContext = useCommandContext()
  const queryClient = useQueryClient()
  const providerId = useDefaultChatProviderId()
  const chain = useProviderChain(providerId)

  return useMutation({
    mutationFn: () => {
      if (!currentWorkspaceId) throw new Error('Select a workspace before generating a briefing.')
      return withProviderAvailability(
        chain,
        () => generateWorkspaceBriefing({ workspaceId: currentWorkspaceId, userId: user!.id, commandContext, chain }),
        { queryClient },
      )
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notes'] })
      void queryClient.invalidateQueries({ queryKey: ['workspace-hub'] })
    },
  })
}
