import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { withProviderAvailability } from '@/modules/ai/orchestration/withProviderAvailability'
import { useDefaultChatProviderId } from '@/modules/ai/providers/useDefaultChatProviderId'
import { useProviderChain } from '@/modules/ai/router/useProviderChain'
import { runWithFallback } from '@/modules/ai/router/runWithFallback'
import { analyzeImage } from '@/modules/assets/intelligence/analyzeImage'
import { runKnowledgeExtractionFromContent } from '@/modules/knowledge-intelligence/api/knowledgeExtraction'
import type { Asset, AssetAnalysis } from '@/shared/types/database'

/**
 * Multimodal Intelligence v1 — "Analyze with NOVA" on an image: the vision
 * call (mirroring useGenerateConversationTitle's withProviderAvailability/
 * runWithFallback composition), then — Phase 8's "visual knowledge
 * extraction," made real by reuse rather than a new engine — the same
 * runKnowledgeExtractionFromContent chain Document Detail's own "Extract
 * Knowledge" button uses, fed by the analysis text with sourceType:
 * 'asset'. Presented as one action, not two, because unlike a document (which
 * already has full-text search/RAG value before any knowledge extraction),
 * an image has none until it's been analyzed — splitting this into two
 * user-triggered steps would leave the more valuable one easy to miss.
 *
 * Unlike title generation, neither step has a deterministic fallback, so a
 * failure here does surface as an error to the caller (the knowledge-
 * extraction step is intentionally forgiving on its own — see
 * runKnowledgeExtractionFromContent's "fewer than 2 nodes" branch — but a
 * genuine provider failure still propagates).
 */
export function useAnalyzeImage() {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()
  const queryClient = useQueryClient()
  const providerId = useDefaultChatProviderId()
  const chain = useProviderChain(providerId)

  return useMutation({
    mutationFn: async (asset: Pick<Asset, 'id' | 'optimized_path'>): Promise<AssetAnalysis> => {
      const analysis = await withProviderAvailability(
        chain,
        () =>
          runWithFallback(chain, (candidateId) =>
            analyzeImage({
              asset,
              userId: user!.id,
              workspaceId: currentWorkspaceId,
              providerId: candidateId,
              requestedProviderId: chain[0],
            }),
          ),
        { queryClient },
      ).then((fallback) => fallback.result)

      const content = analysis.extractedText ? `${analysis.description}\n\nVisible text: ${analysis.extractedText}` : analysis.description

      await withProviderAvailability(
        chain,
        () =>
          runKnowledgeExtractionFromContent({
            content,
            sourceType: 'asset',
            sourceId: asset.id,
            sourceChunkIds: [],
            userId: user!.id,
            workspaceId: currentWorkspaceId,
            chain,
          }),
        { queryClient },
      )

      return analysis
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['assets'] })
      void queryClient.invalidateQueries({ queryKey: ['knowledge-nodes'] })
      void queryClient.invalidateQueries({ queryKey: ['knowledge-edges'] })
      void queryClient.invalidateQueries({ queryKey: ['knowledge-insights'] })
      void queryClient.invalidateQueries({ queryKey: ['knowledge-map'] })
    },
  })
}
