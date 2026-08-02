import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { importNotePackage } from '@/modules/knowledge-exchange/notes/importNotePackage'
import type { NotePackage } from '@/modules/knowledge-exchange/notes/notePackageTypes'

export function useImportNotePackage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: { pkg: NotePackage; workspaceId: string | null }) =>
      importNotePackage(params.pkg, { userId: user!.id, workspaceId: params.workspaceId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] })
    },
  })
}
