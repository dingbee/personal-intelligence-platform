import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { importKnowledgeNodePackage } from '@/modules/knowledge-exchange/knowledge-nodes/importKnowledgeNodePackage'
import type { KnowledgeNodePackage } from '@/modules/knowledge-exchange/knowledge-nodes/knowledgeNodePackageTypes'

export function useImportKnowledgeNodePackage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: { pkg: KnowledgeNodePackage; workspaceId: string | null }) =>
      importKnowledgeNodePackage(params.pkg, { userId: user!.id, workspaceId: params.workspaceId }),
    onSuccess: () => {
      // Matches the query keys useKnowledgeNodeDetails/useKnowledgeIntelligence
      // already invalidate on any node-affecting mutation (e.g. reconcile).
      queryClient.invalidateQueries({ queryKey: ['knowledge-nodes'] })
      queryClient.invalidateQueries({ queryKey: ['knowledge-insights'] })
      queryClient.invalidateQueries({ queryKey: ['knowledge-map'] })
    },
  })
}
