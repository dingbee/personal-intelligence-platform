import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createConversation,
  deleteConversation,
  listConversations,
  renameConversation,
  updateConversationProvider,
} from '@/modules/ai/chat/api/conversations'
import { useAuth } from '@/modules/auth/useAuth'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import type { Conversation } from '@/shared/types/database'

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

  /**
   * Optimistic: the header's ProviderSelect needs the change to take effect
   * immediately (no page refresh, no waiting on a refetch) so the very next
   * send already uses it — conversation.provider_id is read fresh from this
   * same query's cache on every render, so writing it here is enough. Rolls
   * back to the pre-update snapshot on failure rather than leaving the
   * cache holding a value the database rejected.
   */
  const updateProvider = useMutation({
    mutationFn: (params: { id: string; providerId: string }) =>
      updateConversationProvider(params.id, params.providerId),
    onMutate: async (params) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<Conversation[]>(queryKey)
      queryClient.setQueryData<Conversation[]>(queryKey, (old) =>
        old?.map((c) => (c.id === params.id ? { ...c, provider_id: params.providerId } : c)),
      )
      return { previous }
    },
    onError: (_err, _params, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous)
    },
    onSettled: invalidate,
  })

  return { ...query, create, rename, remove, updateProvider }
}
