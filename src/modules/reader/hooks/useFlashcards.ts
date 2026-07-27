import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { createFlashcards, listFlashcards } from '@/modules/reader/api/flashcards'
import { runCapability } from '@/modules/ai/orchestration/runCapability'
import { parseFlashcardsResponse } from '@/modules/reader/utils/parseFlashcardsResponse'

export function useFlashcards(documentId: string, chapterIndex: number) {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()
  const queryClient = useQueryClient()
  const queryKey = ['flashcards', documentId, chapterIndex]

  const query = useQuery({
    queryKey,
    queryFn: () => listFlashcards(documentId, chapterIndex),
    enabled: Boolean(user),
  })

  const generate = useMutation({
    mutationFn: async (chapterText: string) => {
      const { content } = await runCapability({
        capabilityId: 'flashcards',
        variables: { content: chapterText },
        userId: user!.id,
        workspaceId: currentWorkspaceId,
      })
      const cards = parseFlashcardsResponse(content)
      return createFlashcards({ documentId, userId: user!.id, chapterIndex, cards })
    },
    onSuccess: (created) => {
      queryClient.setQueryData(queryKey, (prev: Awaited<ReturnType<typeof listFlashcards>> | undefined) => [
        ...(prev ?? []),
        ...created,
      ])
    },
  })

  return { flashcards: query.data ?? [], isLoading: query.isLoading, generate }
}
