import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { buildGraphInteractionState } from '@/modules/knowledge/intelligence/graphInteraction'

/**
 * UX-10 Phase 8/9 — the one React Query wrapper around
 * buildGraphInteractionState, reused by the Knowledge Explorer's Graph
 * Workspace panel and the Personal Intelligence Timeline's knowledge
 * highlight (Phase 11), so neither refetches the graph independently.
 */
export function useGraphInteractionState(options: { enabled?: boolean } = {}) {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()

  return useQuery({
    queryKey: ['graph-interaction-state', currentWorkspaceId],
    queryFn: () => buildGraphInteractionState({ workspaceId: currentWorkspaceId }),
    enabled: Boolean(user) && (options.enabled ?? true),
  })
}
