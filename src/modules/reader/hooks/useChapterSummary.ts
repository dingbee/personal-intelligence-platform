import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { getChapterSummary, saveChapterSummary } from '@/modules/reader/api/chapterSummaries'
import { runCapability } from '@/modules/ai/orchestration/runCapability'

export function useChapterSummary(documentId: string, chapterIndex: number) {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()
  const queryClient = useQueryClient()
  const queryKey = ['chapter-summary', documentId, chapterIndex]

  const query = useQuery({
    queryKey,
    queryFn: () => getChapterSummary(documentId, chapterIndex),
    enabled: Boolean(user),
  })

  const generate = useMutation({
    mutationFn: async (chapterText: string) => {
      const { content, model } = await runCapability({
        capabilityId: 'summarize',
        variables: { content: chapterText },
        userId: user!.id,
        workspaceId: currentWorkspaceId,
      })
      return saveChapterSummary({
        documentId,
        userId: user!.id,
        chapterIndex,
        content,
        model: model ?? 'unknown',
      })
    },
    onSuccess: (summary) => queryClient.setQueryData(queryKey, summary),
  })

  return { summary: query.data, isLoading: query.isLoading, generate }
}
