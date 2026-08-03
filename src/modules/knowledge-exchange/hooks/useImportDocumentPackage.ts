import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { importDocumentPackage } from '@/modules/knowledge-exchange/documents/importDocumentPackage'
import type { ValidatedDocumentPackage } from '@/modules/knowledge-exchange/documents/validateDocumentPackage'

export function useImportDocumentPackage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: { pkg: ValidatedDocumentPackage; workspaceId: string | null }) =>
      importDocumentPackage(params.pkg, { userId: user!.id, workspaceId: params.workspaceId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
    },
  })
}
