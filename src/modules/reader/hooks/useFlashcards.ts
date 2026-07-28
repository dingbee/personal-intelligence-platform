import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { createFlashcards, listFlashcards } from '@/modules/reader/api/flashcards'
import { runCapability } from '@/modules/ai/orchestration/runCapability'
import { withProviderAvailability } from '@/modules/ai/orchestration/withProviderAvailability'
import { useDefaultChatProviderId } from '@/modules/ai/providers/useDefaultChatProviderId'
import { useProviderChain } from '@/modules/ai/router/useProviderChain'
import { runWithFallback } from '@/modules/ai/router/runWithFallback'
import { parseFlashcardsResponse } from '@/modules/reader/utils/parseFlashcardsResponse'

export function useFlashcards(documentId: string, chapterIndex: number) {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()
  const queryClient = useQueryClient()
  const providerId = useDefaultChatProviderId()
  const chain = useProviderChain(providerId)
  const queryKey = ['flashcards', documentId, chapterIndex]

  const query = useQuery({
    queryKey,
    queryFn: () => listFlashcards(documentId, chapterIndex),
    enabled: Boolean(user),
  })

  const generate = useMutation({
    mutationFn: async (chapterText: string) => {
      const {
        result: { content },
      } = await withProviderAvailability(
        chain,
        () =>
          runWithFallback(chain, (candidateId) =>
            runCapability({
              capabilityId: 'flashcards',
              variables: { content: chapterText },
              userId: user!.id,
              workspaceId: currentWorkspaceId,
              providerId: candidateId,
              requestedProviderId: chain[0],
            }),
          ),
        { queryClient },
      )
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
