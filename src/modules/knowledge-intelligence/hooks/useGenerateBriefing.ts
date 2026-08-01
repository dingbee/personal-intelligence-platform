import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { useKnowledgeNodeEvidence } from '@/modules/knowledge-intelligence/hooks/useKnowledgeNodeEvidence'
import { generateBriefing } from '@/modules/knowledge-intelligence/api/generateBriefing'
import { useDefaultChatProviderId } from '@/modules/ai/providers/useDefaultChatProviderId'
import { useProviderChain } from '@/modules/ai/router/useProviderChain'
import { withProviderAvailability } from '@/modules/ai/orchestration/withProviderAvailability'
import { indexNote } from '@/modules/search/indexing/indexNote'
import { linkKnownConceptsToSource } from '@/modules/knowledge-intelligence/api/linkKnownConcepts'

/**
 * Knowledge Actions v1 — Generate Briefing. Reads the same
 * useKnowledgeNodeEvidence(nodeId) query the drill-down page already has
 * mounted (TanStack Query dedupes it, so this is cache reuse, not a
 * second fetch) rather than requiring the caller to pass evidence down.
 */
export function useGenerateBriefing(nodeId: string) {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()
  const queryClient = useQueryClient()
  const { data: evidence } = useKnowledgeNodeEvidence(nodeId)
  const providerId = useDefaultChatProviderId()
  const chain = useProviderChain(providerId)

  return useMutation({
    mutationFn: () => {
      if (!evidence) throw new Error('This concept has not finished loading yet.')
      return withProviderAvailability(
        chain,
        () => generateBriefing({ evidence, userId: user!.id, workspaceId: currentWorkspaceId, chain }),
        { queryClient },
      )
    },
    onSuccess: (note) => {
      void queryClient.invalidateQueries({ queryKey: ['knowledge-node-evidence', nodeId] })
      void queryClient.invalidateQueries({ queryKey: ['notes'] })
      void indexNote(note, currentWorkspaceId)
      void linkKnownConceptsToSource({
        userId: note.user_id,
        sourceType: 'note',
        sourceId: note.id,
        text: `${note.title}\n\n${note.content}`,
      })
    },
  })
}
