import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createKnowledgeCollection, listKnowledgeCollections } from '@/modules/knowledge-intelligence/api/knowledgeCollections'
import { useAuth } from '@/modules/auth/useAuth'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'

/** UX-13 roadmap Phase 4 — Knowledge Collections list + create, same shape as useNotes. */
export function useKnowledgeCollections() {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()
  const queryClient = useQueryClient()
  const queryKey = ['knowledge-collections', currentWorkspaceId]

  const query = useQuery({
    queryKey,
    queryFn: () => listKnowledgeCollections({ workspaceId: currentWorkspaceId }),
    enabled: Boolean(user),
  })

  const create = useMutation({
    mutationFn: (params: { name: string; description?: string }) =>
      createKnowledgeCollection({ ...params, userId: user!.id, workspaceId: currentWorkspaceId }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['knowledge-collections'] }),
  })

  return { ...query, create }
}
