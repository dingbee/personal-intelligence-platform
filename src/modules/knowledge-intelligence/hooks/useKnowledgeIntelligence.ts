import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { listKnowledgeNodes } from '@/modules/knowledge-intelligence/api/knowledgeNodes'
import { listKnowledgeLinks } from '@/modules/knowledge-graph/api/graph'
import { getKnowledgeInsights } from '@/modules/knowledge-intelligence/api/knowledgeInsights'
import { generateKnowledgeMap } from '@/modules/knowledge-intelligence/api/knowledgeMap'
import { runKnowledgeExtraction } from '@/modules/knowledge-intelligence/api/knowledgeExtraction'
import { withProviderAvailability } from '@/modules/ai/orchestration/withProviderAvailability'
import { useProviderAvailability } from '@/modules/ai/providers/useProviderAvailability'
import { useDefaultChatProviderId } from '@/modules/ai/providers/useDefaultChatProviderId'

/** Readiness hooks for a future Knowledge Intelligence UI (Phase 7B+) — no visualization consumes these yet. */

export function useKnowledgeNodes(documentId?: string) {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()
  return useQuery({
    queryKey: ['knowledge-nodes', currentWorkspaceId, documentId],
    queryFn: () => listKnowledgeNodes({ workspaceId: currentWorkspaceId, documentId }),
    enabled: Boolean(user),
  })
}

export function useKnowledgeEdges() {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()
  return useQuery({
    queryKey: ['knowledge-edges', currentWorkspaceId],
    queryFn: () => listKnowledgeLinks(currentWorkspaceId),
    enabled: Boolean(user),
  })
}

export function useKnowledgeInsights() {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()
  return useQuery({
    queryKey: ['knowledge-insights', currentWorkspaceId],
    queryFn: () => getKnowledgeInsights(currentWorkspaceId),
    enabled: Boolean(user),
  })
}

export function useKnowledgeMap() {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()
  return useQuery({
    queryKey: ['knowledge-map', currentWorkspaceId],
    queryFn: () => generateKnowledgeMap(currentWorkspaceId),
    enabled: Boolean(user),
  })
}

export function useRunKnowledgeExtraction(documentId: string) {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()
  const queryClient = useQueryClient()
  const { data: availability } = useProviderAvailability()
  const providerId = useDefaultChatProviderId()

  return useMutation({
    mutationFn: () =>
      withProviderAvailability(
        providerId,
        () => runKnowledgeExtraction({ documentId, userId: user!.id, workspaceId: currentWorkspaceId, providerId }),
        { availability, queryClient },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-nodes'] })
      queryClient.invalidateQueries({ queryKey: ['knowledge-edges'] })
      queryClient.invalidateQueries({ queryKey: ['knowledge-insights'] })
      queryClient.invalidateQueries({ queryKey: ['knowledge-map'] })
    },
  })
}
