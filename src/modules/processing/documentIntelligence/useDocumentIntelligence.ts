import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { withProviderAvailability } from '@/modules/ai/orchestration/withProviderAvailability'
import { useDefaultChatProviderId } from '@/modules/ai/providers/useDefaultChatProviderId'
import { useProviderChain } from '@/modules/ai/router/useProviderChain'
import { runDocumentIntelligence } from '@/modules/processing/documentIntelligence/runDocumentIntelligence'

/** Mirrors useRunKnowledgeExtraction's composition exactly — same withProviderAvailability wrapping, no outer runWithFallback here since runDocumentIntelligence already does its own for the one capability call it makes. */
export function useRunDocumentIntelligence(documentId: string) {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()
  const queryClient = useQueryClient()
  const providerId = useDefaultChatProviderId()
  const chain = useProviderChain(providerId)

  return useMutation({
    mutationFn: () =>
      withProviderAvailability(
        chain,
        () => runDocumentIntelligence({ documentId, userId: user!.id, workspaceId: currentWorkspaceId, chain }),
        { queryClient },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['document', documentId] })
      void queryClient.invalidateQueries({ queryKey: ['document-detail', documentId] })
      void queryClient.invalidateQueries({ queryKey: ['extraction-metadata', documentId] })
    },
  })
}
