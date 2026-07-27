import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createNote, deleteNote } from '@/modules/notes/api/notes'
import { useAuth } from '@/modules/auth/useAuth'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'

export function useNoteMutations() {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['notes'] })

  const create = useMutation({
    mutationFn: (params: { collectionId?: string | null; documentId?: string | null; title?: string }) =>
      createNote({ ...params, userId: user!.id, workspaceId: currentWorkspaceId }),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteNote(id),
    onSuccess: invalidate,
  })

  return { create, remove }
}
