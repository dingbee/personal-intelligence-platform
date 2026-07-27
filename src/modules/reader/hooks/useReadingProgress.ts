import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { getReadingProgress, saveReadingProgress } from '@/modules/reader/api/readingProgress'

export function useReadingProgress(documentId: string) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const queryKey = ['reading-progress', documentId]

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => getReadingProgress(documentId),
    enabled: Boolean(user),
  })

  const mutation = useMutation({
    mutationFn: (next: { chapterIndex: number; scrollFraction: number }) =>
      saveReadingProgress({ documentId, userId: user!.id, ...next }),
    onSuccess: (_data, next) => {
      queryClient.setQueryData(queryKey, {
        document_id: documentId,
        user_id: user!.id,
        chapter_index: next.chapterIndex,
        scroll_fraction: next.scrollFraction,
        updated_at: new Date().toISOString(),
      })
    },
  })

  return {
    progress: { chapterIndex: data?.chapter_index ?? 0, scrollFraction: data?.scroll_fraction ?? 0 },
    isLoading,
    save: (next: { chapterIndex: number; scrollFraction: number }) => mutation.mutate(next),
  }
}
