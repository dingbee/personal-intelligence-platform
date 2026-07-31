import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { getChapterSummary, saveChapterSummary } from '@/modules/reader/api/chapterSummaries'
import { runCapability } from '@/modules/ai/orchestration/runCapability'
import { retrieveGraphContext } from '@/modules/knowledge-intelligence/api/retrieveGraphContext'
import { retrieveSpreadsheetContext } from '@/modules/processing/api/retrieveSpreadsheetContext'
import { withProviderAvailability } from '@/modules/ai/orchestration/withProviderAvailability'
import { useDefaultChatProviderId } from '@/modules/ai/providers/useDefaultChatProviderId'
import { useProviderChain } from '@/modules/ai/router/useProviderChain'
import { runWithFallback } from '@/modules/ai/router/runWithFallback'

export function useChapterSummary(documentId: string, chapterIndex: number) {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()
  const queryClient = useQueryClient()
  const providerId = useDefaultChatProviderId()
  const chain = useProviderChain(providerId)
  const queryKey = ['chapter-summary', documentId, chapterIndex]

  const query = useQuery({
    queryKey,
    queryFn: () => getChapterSummary(documentId, chapterIndex),
    enabled: Boolean(user),
  })

  const generate = useMutation({
    mutationFn: async (chapterText: string) => {
      // UX-13 Unified Intelligence Pipeline — same knowledge-graph lookup
      // AIService.sendMessage uses for Chat's <knowledge_connections> block
      // (retrieveGraphContext, scoped to this document), so the chapter/
      // sheet summary is grounded in the same canonical extracted knowledge
      // Chat answers from, instead of independently re-reading the raw
      // content and risking a contradictory interpretation.
      const knowledgeContext = await retrieveGraphContext({
        documentIds: [documentId],
        userId: user!.id,
        workspaceId: currentWorkspaceId,
      })
      // UX-13.10.1 — same <spreadsheet_analysis> block Chat is grounded in
      // (retrieveSpreadsheetContext), so for a spreadsheet document the
      // Summary panel and Chat draw from the exact same computed figures —
      // the "single source of truth" fix for the Information-panel-vs-Chat
      // contradiction. No-op (returns null) for every non-spreadsheet
      // document or one with no analysis computed yet.
      const spreadsheetContext = await retrieveSpreadsheetContext(documentId)
      const {
        result: { content, model },
      } = await withProviderAvailability(
        chain,
        () =>
          runWithFallback(chain, (candidateId) =>
            runCapability({
              capabilityId: 'summarize',
              variables: { content: chapterText },
              knowledgeContext,
              spreadsheetContext,
              userId: user!.id,
              workspaceId: currentWorkspaceId,
              providerId: candidateId,
              requestedProviderId: chain[0],
            }),
          ),
        { queryClient },
      )
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
