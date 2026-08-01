import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getKnowledgeCollection,
  updateKnowledgeCollection,
  deleteKnowledgeCollection,
  listCollectionItems,
  removeItemFromCollection,
  type CollectionItemType,
} from '@/modules/knowledge-intelligence/api/knowledgeCollections'

/** UX-13 roadmap Phase 4 — a single collection's detail: its own metadata plus its resolved item list, mirroring useNote/useKnowledgeNodeEvidence's pairing. */
export function useKnowledgeCollection(collectionId: string) {
  const queryClient = useQueryClient()
  const collectionQuery = useQuery({
    queryKey: ['knowledge-collection', collectionId],
    queryFn: () => getKnowledgeCollection(collectionId),
    enabled: Boolean(collectionId),
  })
  const itemsQuery = useQuery({
    queryKey: ['knowledge-collection-items', collectionId],
    queryFn: () => listCollectionItems(collectionId),
    enabled: Boolean(collectionId),
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['knowledge-collection', collectionId] })
    void queryClient.invalidateQueries({ queryKey: ['knowledge-collection-items', collectionId] })
    void queryClient.invalidateQueries({ queryKey: ['knowledge-collections'] })
  }

  const update = useMutation({
    mutationFn: (updates: { name?: string; description?: string }) => updateKnowledgeCollection(collectionId, updates),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: () => deleteKnowledgeCollection(collectionId),
  })

  const removeItem = useMutation({
    mutationFn: (item: { itemType: CollectionItemType; itemId: string }) =>
      removeItemFromCollection({ collectionId, ...item }),
    onSuccess: invalidate,
  })

  return {
    collection: collectionQuery.data,
    isLoading: collectionQuery.isLoading,
    isError: collectionQuery.isError,
    items: itemsQuery.data ?? [],
    itemsLoading: itemsQuery.isLoading,
    update,
    remove,
    removeItem,
  }
}
