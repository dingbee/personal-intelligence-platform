import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { dismissItem, listDismissedItemKeys } from '@/modules/intelligence/dismissals/api'
import { useAuth } from '@/modules/auth/useAuth'

/**
 * AI Experience Intelligence v1 — backs the dismiss control on Hub's
 * IntelligenceZoneItems and RecommendedActionsSection. Optimistic like
 * useConversations' togglePin/toggleFavorite: the item should disappear the
 * instant it's dismissed, not after a round trip, and there's nothing to
 * roll forward here (dismissing is idempotent — see dismissItem's
 * ignoreDuplicates), only to roll back on a genuine write failure.
 */
export function useDismissedSuggestions(workspaceId: string | null) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const queryKey = ['dismissed-suggestions', workspaceId]

  const query = useQuery({
    queryKey,
    queryFn: () => listDismissedItemKeys(workspaceId!),
    enabled: Boolean(user) && Boolean(workspaceId),
  })

  const dismiss = useMutation({
    mutationFn: (itemKey: string) => dismissItem({ workspaceId: workspaceId!, userId: user!.id, itemKey }),
    onMutate: async (itemKey) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<Set<string>>(queryKey)
      queryClient.setQueryData<Set<string>>(queryKey, (old) => new Set(old).add(itemKey))
      return { previous }
    },
    onError: (_err, _itemKey, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  })

  return { dismissedKeys: query.data ?? new Set<string>(), isLoading: query.isLoading, dismiss: dismiss.mutate }
}
