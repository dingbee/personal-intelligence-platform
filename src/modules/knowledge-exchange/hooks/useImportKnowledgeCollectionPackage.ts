import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { importKnowledgeCollectionPackage } from '@/modules/knowledge-exchange/knowledge-collections/importKnowledgeCollectionPackage'
import type { ValidatedCollectionPackage } from '@/modules/knowledge-exchange/knowledge-collections/validateKnowledgeCollectionPackage'

/**
 * UX-14.5.10.6 — a Collection import can touch every member type at once
 * (knowledge nodes, notes, assets, documents) plus the relationships
 * between nodes, so this invalidates every query key any single-type
 * import already invalidates (`useImportKnowledgeLinkPackage`'s own set,
 * plus notes/assets/documents' own list keys) rather than a narrower
 * subset that would leave some list view stale after a mixed-member import.
 */
export function useImportKnowledgeCollectionPackage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: { pkg: ValidatedCollectionPackage; workspaceId: string | null }) =>
      importKnowledgeCollectionPackage(params.pkg, { userId: user!.id, workspaceId: params.workspaceId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-collections'] })
      queryClient.invalidateQueries({ queryKey: ['knowledge-collection'] })
      queryClient.invalidateQueries({ queryKey: ['knowledge-collection-items'] })
      queryClient.invalidateQueries({ queryKey: ['knowledge-nodes'] })
      queryClient.invalidateQueries({ queryKey: ['knowledge-edges'] })
      queryClient.invalidateQueries({ queryKey: ['knowledge-insights'] })
      queryClient.invalidateQueries({ queryKey: ['knowledge-map'] })
      queryClient.invalidateQueries({ queryKey: ['knowledge-node-evidence'] })
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      queryClient.invalidateQueries({ queryKey: ['documents'] })
    },
  })
}
