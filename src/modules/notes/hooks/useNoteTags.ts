import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addTagToNote, listTagsForNote, removeTagFromNote } from '@/modules/notes/api/noteTags'
import { useAuth } from '@/modules/auth/useAuth'

export function useNoteTags(noteId: string) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const queryKey = ['note-tags', noteId]

  const query = useQuery({
    queryKey,
    queryFn: () => listTagsForNote(noteId),
    enabled: Boolean(user) && Boolean(noteId),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey })

  const addTag = useMutation({
    mutationFn: (tagName: string) => addTagToNote({ noteId, tagName, userId: user!.id }),
    onSuccess: invalidate,
  })

  const removeTag = useMutation({
    mutationFn: (tagId: string) => removeTagFromNote(noteId, tagId),
    onSuccess: invalidate,
  })

  return { tags: query.data ?? [], isLoading: query.isLoading, addTag, removeTag }
}
