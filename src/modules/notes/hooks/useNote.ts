import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getNote, updateNote } from '@/modules/notes/api/notes'
import { addTagToNote, removeTagFromNote } from '@/modules/notes/api/noteTags'
import { useAuth } from '@/modules/auth/useAuth'

export function useNote(noteId: string) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const queryKey = ['note', noteId]

  const query = useQuery({
    queryKey,
    queryFn: () => getNote(noteId),
    enabled: Boolean(user) && Boolean(noteId),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey })
    queryClient.invalidateQueries({ queryKey: ['notes'] })
  }

  const save = useMutation({
    mutationFn: (updates: { title?: string; content?: string; collection_id?: string | null }) =>
      updateNote(noteId, updates),
    onSuccess: invalidate,
  })

  const addTag = useMutation({
    mutationFn: (tagName: string) => addTagToNote({ noteId, tagName, userId: user!.id }),
    onSuccess: invalidate,
  })

  const removeTag = useMutation({
    mutationFn: (tagId: string) => removeTagFromNote(noteId, tagId),
    onSuccess: invalidate,
  })

  return {
    note: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    save,
    addTag,
    removeTag,
  }
}
