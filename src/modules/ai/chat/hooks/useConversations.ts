import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  archiveConversation,
  createConversation,
  deleteConversation,
  duplicateConversation,
  listConversations,
  renameConversation,
  restoreConversation,
  setConversationFavorite,
  setConversationPinned,
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

  /**
   * UX-13.5A — optimistic for the same reason updateProvider is: the
   * header title and the sidebar row both read straight from this
   * query's cache, so a rename (whether user-typed or AI-generated)
   * should be visible the instant it's submitted, not after a round
   * trip. Rolls back on failure rather than leaving a title the
   * database rejected.
   */
  const rename = useMutation({
    mutationFn: (params: { id: string; title: string }) => renameConversation(params.id, params.title),
    onMutate: async (params) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<Conversation[]>(queryKey)
      queryClient.setQueryData<Conversation[]>(queryKey, (old) =>
        old?.map((c) => (c.id === params.id ? { ...c, title: params.title } : c)),
      )
      return { previous }
    },
    onError: (_err, _params, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous)
    },
    onSettled: invalidate,
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteConversation(id),
    onSuccess: invalidate,
  })

  /** UX-13.5B — removes the conversation from this (active) list; invalidating both the active and archived query keys is what makes it reappear in the archive view without a manual refetch. */
  const archive = useMutation({
    mutationFn: (id: string) => archiveConversation(id),
    onSuccess: invalidate,
  })

  const restore = useMutation({
    mutationFn: (id: string) => restoreConversation(id),
    onSuccess: invalidate,
  })

  const duplicate = useMutation({
    mutationFn: (id: string) => duplicateConversation(id, user!.id),
    onSuccess: invalidate,
  })

  /**
   * UX-13.6 — optimistic in place (flip the flag, don't resort): the
   * actual pinned-first reordering comes from listConversations' own
   * `is_pinned desc` sort on the next refetch (onSettled), same as
   * updateProvider's "flip the field now, let the real order arrive
   * shortly after" tradeoff.
   */
  const togglePin = useMutation({
    mutationFn: (params: { id: string; isPinned: boolean }) => setConversationPinned(params.id, params.isPinned),
    onMutate: async (params) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<Conversation[]>(queryKey)
      queryClient.setQueryData<Conversation[]>(queryKey, (old) =>
        old?.map((c) => (c.id === params.id ? { ...c, is_pinned: params.isPinned } : c)),
      )
      return { previous }
    },
    onError: (_err, _params, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous)
    },
    onSettled: invalidate,
  })

  const toggleFavorite = useMutation({
    mutationFn: (params: { id: string; favorite: boolean }) => setConversationFavorite(params.id, params.favorite),
    onMutate: async (params) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<Conversation[]>(queryKey)
      queryClient.setQueryData<Conversation[]>(queryKey, (old) =>
        old?.map((c) => (c.id === params.id ? { ...c, favorite: params.favorite } : c)),
      )
      return { previous }
    },
    onError: (_err, _params, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous)
    },
    onSettled: invalidate,
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

  return { ...query, create, rename, remove, archive, restore, duplicate, togglePin, toggleFavorite, updateProvider }
}
