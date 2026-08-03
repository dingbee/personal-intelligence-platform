import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { importKnowledgeLinkPackage } from '@/modules/knowledge-exchange/knowledge-links/importKnowledgeLinkPackage'
import type { KnowledgeLinkPackage } from '@/modules/knowledge-exchange/knowledge-links/knowledgeLinkPackageTypes'

/** Invalidates the same four query keys `useRunKnowledgeExtraction` does — this import, like that one, can both create new nodes and a new edge between them. */
export function useImportKnowledgeLinkPackage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: { pkg: KnowledgeLinkPackage; workspaceId: string | null }) =>
      importKnowledgeLinkPackage(params.pkg, { userId: user!.id, workspaceId: params.workspaceId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-nodes'] })
      queryClient.invalidateQueries({ queryKey: ['knowledge-edges'] })
      queryClient.invalidateQueries({ queryKey: ['knowledge-insights'] })
      queryClient.invalidateQueries({ queryKey: ['knowledge-map'] })
      queryClient.invalidateQueries({ queryKey: ['knowledge-node-evidence'] })
    },
  })
}
