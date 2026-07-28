import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createNote, deleteNote, listNotes, type NoteFilters } from '@/modules/notes/api/notes'
import { useAuth } from '@/modules/auth/useAuth'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'

export function useNotes(filters: Omit<NoteFilters, 'workspaceId'> = {}) {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()
  const queryClient = useQueryClient()
  const scopedFilters: NoteFilters = { ...filters, workspaceId: currentWorkspaceId }
  const queryKey = ['notes', scopedFilters]

  const query = useQuery({
    queryKey,
    queryFn: () => listNotes(scopedFilters),
    enabled: Boolean(user),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['notes'] })

  const create = useMutation({
    mutationFn: (params: {
      title?: string
      content?: string
      documentId?: string | null
      sourceChunkIds?: string[] | null
    }) => createNote({ ...params, userId: user!.id, workspaceId: currentWorkspaceId }),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteNote(id),
    onSuccess: invalidate,
  })

  return { ...query, create, remove }
}
