import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { useCommandContext } from '@/modules/commands/hooks/useCommandContext'
import { reviewWorkspaceObjectives } from '@/modules/workspace-intelligence/api/reviewWorkspaceObjectives'
import { useDefaultChatProviderId } from '@/modules/ai/providers/useDefaultChatProviderId'
import { useProviderChain } from '@/modules/ai/router/useProviderChain'
import { withProviderAvailability } from '@/modules/ai/orchestration/withProviderAvailability'

export function useReviewWorkspaceObjectives() {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()
  const commandContext = useCommandContext()
  const queryClient = useQueryClient()
  const providerId = useDefaultChatProviderId()
  const chain = useProviderChain(providerId)

  return useMutation({
    mutationFn: () => {
      if (!currentWorkspaceId) throw new Error('Select a workspace before reviewing objectives.')
      return withProviderAvailability(
        chain,
        () => reviewWorkspaceObjectives({ workspaceId: currentWorkspaceId, userId: user!.id, commandContext, chain }),
        { queryClient },
      )
    },
  })
}
