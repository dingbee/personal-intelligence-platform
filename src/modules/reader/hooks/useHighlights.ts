import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import {
  createHighlight,
  deleteHighlight,
  listHighlights,
  updateHighlightNote,
} from '@/modules/reader/api/highlights'

export function useHighlights(documentId: string, chapterIndex: number) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const queryKey = ['highlights', documentId, chapterIndex]

  const query = useQuery({
    queryKey,
    queryFn: () => listHighlights(documentId, chapterIndex),
    enabled: Boolean(user),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey })

  const add = useMutation({
    mutationFn: (quote: string) =>
      createHighlight({ documentId, userId: user!.id, chapterIndex, quote }),
    onSuccess: invalidate,
  })

  const setNote = useMutation({
    mutationFn: (params: { id: string; note: string | null }) => updateHighlightNote(params.id, params.note),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteHighlight(id),
    onSuccess: invalidate,
  })

  return { highlights: query.data ?? [], isLoading: query.isLoading, add, setNote, remove }
}
