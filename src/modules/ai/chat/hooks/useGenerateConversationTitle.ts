import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { runCapability } from '@/modules/ai/orchestration/runCapability'
import { withProviderAvailability } from '@/modules/ai/orchestration/withProviderAvailability'
import { useDefaultChatProviderId } from '@/modules/ai/providers/useDefaultChatProviderId'
import { useProviderChain } from '@/modules/ai/router/useProviderChain'
import { runWithFallback } from '@/modules/ai/router/runWithFallback'
import { finalizeGeneratedTitle, type GeneratedTitle } from '@/modules/intelligence/conversation/conversationTitle/titleGenerator'

/**
 * UX-13.5A — title generation via the existing one-shot AI capability
 * pathway (runCapability + withProviderAvailability + runWithFallback),
 * the same mechanism useChapterSummary/useGenerateFlashcards already use
 * for Summarize/Flashcards. This is NOT the RAG chat pipeline
 * (AIService.sendMessage) — no provider, router, streaming, or retrieval
 * code is touched.
 *
 * Deliberately never rejects: any failure to reach a provider (all
 * unavailable, network error, capability error) is caught here and
 * treated the same as "no AI candidate" — finalizeGeneratedTitle's
 * deterministic fallback always produces a usable title, so the caller
 * never needs its own try/catch to get a title for the very first
 * message of a conversation.
 */
export function useGenerateConversationTitle() {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()
  const queryClient = useQueryClient()
  const providerId = useDefaultChatProviderId()
  const chain = useProviderChain(providerId)

  return useMutation({
    mutationFn: async (firstMessage: string): Promise<GeneratedTitle> => {
      let candidate: string | null = null
      try {
        const {
          result: { content },
        } = await withProviderAvailability(
          chain,
          () =>
            runWithFallback(chain, (candidateId) =>
              runCapability({
                capabilityId: 'generate-conversation-title',
                variables: { message: firstMessage },
                userId: user!.id,
                workspaceId: currentWorkspaceId,
                providerId: candidateId,
                requestedProviderId: chain[0],
              }),
            ),
          { queryClient },
        )
        candidate = content
      } catch {
        candidate = null
      }
      return finalizeGeneratedTitle(candidate, firstMessage)
    },
  })
}
