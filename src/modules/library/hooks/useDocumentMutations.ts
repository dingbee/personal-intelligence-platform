import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  deleteDocument,
  moveDocument,
  renameDocument,
  uploadDocument,
} from '@/modules/library/api/documents'
import { importGoogleDriveFile, type PickedDriveFile } from '@/modules/library/api/googleDrive'
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

  // Import from Google Drive — the file itself is downloaded and inserted
  // into `documents` server-side (google-drive-import edge function), so
  // this mutation's own job is only to trigger the SAME client-side
  // extraction/chunking/embedding pipeline `upload` already triggers on
  // success (processDocument runs in the browser — pdf.js and friends —
  // and cannot run inside the Deno edge function). An 'already_imported'
  // outcome (this exact Drive file was imported before) is a normal,
  // successful no-op: the document already exists and was already
  // processed, so processDocument must not run again for it.
  const importFromGoogleDrive = useMutation({
    mutationFn: (params: { file: PickedDriveFile; collectionId: string | null }) =>
      importGoogleDriveFile(params.file, { collectionId: params.collectionId, workspaceId: currentWorkspaceId }),
    onSuccess: (result) => {
      invalidate()
      if (result.outcome === 'imported') {
        void processDocument(result.document.id, user!.id)
      }
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

  return { upload, importFromGoogleDrive, rename, move, remove }
}
