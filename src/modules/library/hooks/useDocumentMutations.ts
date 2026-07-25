import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  deleteDocument,
  moveDocument,
  renameDocument,
  uploadDocument,
} from '@/modules/library/api/documents'
import { useAuth } from '@/modules/auth/useAuth'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { processDocument } from '@/modules/processing/pipeline/processDocument'

export function useDocumentMutations() {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['documents'] })

  const upload = useMutation({
    mutationFn: (params: { file: File; collectionId: string | null }) =>
      uploadDocument({ ...params, userId: user!.id, workspaceId: currentWorkspaceId }),
    onSuccess: (document) => {
      invalidate()
      // Fire-and-forget: the pipeline reports progress via processing_jobs,
      // which the library UI polls — nothing here needs to await it.
      void processDocument(document.id, user!.id)
    },
  })

  const rename = useMutation({
    mutationFn: (params: { id: string; title: string }) => renameDocument(params.id, params.title),
    onSuccess: invalidate,
  })

  const move = useMutation({
    mutationFn: (params: { id: string; collectionId: string | null }) =>
      moveDocument(params.id, params.collectionId),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: (params: { id: string; filePath: string }) =>
      deleteDocument(params.id, params.filePath),
    onSuccess: invalidate,
  })

  return { upload, rename, move, remove }
}
