import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createConversation,
  deleteConversation,
  listConversations,
  renameConversation,
} from '@/modules/ai/chat/api/conversations'
import { useAuth } from '@/modules/auth/useAuth'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'

export function useConversations(documentId?: string) {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()
  const queryClient = useQueryClient()
  const queryKey = ['conversations', currentWorkspaceId, documentId]

  const query = useQuery({
    queryKey,
    queryFn: () => listConversations({ workspaceId: currentWorkspaceId, documentId }),
    enabled: Boolean(user),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['conversations'] })

  const create = useMutation({
    mutationFn: (params: { title?: string; providerId?: string }) =>
      createConversation({ ...params, userId: user!.id, workspaceId: currentWorkspaceId, documentId }),
    onSuccess: invalidate,
  })

  const rename = useMutation({
    mutationFn: (params: { id: string; title: string }) => renameConversation(params.id, params.title),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteConversation(id),
    onSuccess: invalidate,
  })

  return { ...query, create, rename, remove }
}
