import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createNote, deleteNote, listNotes, type NoteFilters } from '@/modules/notes/api/notes'
import { useAuth } from '@/modules/auth/useAuth'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { indexNote } from '@/modules/search/indexing/indexNote'
import { linkKnownConceptsToSource } from '@/modules/knowledge-intelligence/api/linkKnownConcepts'
import { withCreationMethod } from '@/modules/ai/artifacts/artifactMetadata'

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
    }) =>
      createNote({
        ...params,
        userId: user!.id,
        workspaceId: currentWorkspaceId,
        generationMetadata: withCreationMethod(null, 'user_created'),
      }),
    onSuccess: (note) => {
      invalidate()
      void indexNote(note, currentWorkspaceId)
      void linkKnownConceptsToSource({ userId: note.user_id, sourceType: 'note', sourceId: note.id, text: `${note.title}\n\n${note.content}` })
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteNote(id),
    onSuccess: invalidate,
  })

  return { ...query, create, remove }
}
