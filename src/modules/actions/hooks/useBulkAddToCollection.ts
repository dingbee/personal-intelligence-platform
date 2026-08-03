import { useMutation, useQueryClient } from '@tanstack/react-query'
import { addItemToCollection, type CollectionItemType } from '@/modules/knowledge-intelligence/api/knowledgeCollections'
import { useAuth } from '@/modules/auth/useAuth'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'

/**
 * UX-15.4 Phase 4 — multi-select "Add to collection," reusing
 * `addItemToCollection` (the exact function `AddToCollectionButton`
 * already calls for a single item) in a `Promise.all` loop rather than
 * a new batch endpoint, per the task's own constraint.
 */
export function useBulkAddToCollection(itemType: CollectionItemType) {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ collectionId, itemIds }: { collectionId: string; itemIds: string[] }) => {
      await Promise.all(
        itemIds.map((itemId) =>
          addItemToCollection({ userId: user!.id, workspaceId: currentWorkspaceId, collectionId, itemType, itemId }),
        ),
      )
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['knowledge-collections'] }),
  })
}
