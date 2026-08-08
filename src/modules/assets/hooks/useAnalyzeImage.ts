import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { withProviderAvailability } from '@/modules/ai/orchestration/withProviderAvailability'
import { useDefaultChatProviderId } from '@/modules/ai/providers/useDefaultChatProviderId'
import { useProviderChain } from '@/modules/ai/router/useProviderChain'
import { runWithFallback } from '@/modules/ai/router/runWithFallback'
import { analyzeImage } from '@/modules/assets/intelligence/analyzeImage'
import { updateAssetMetadata } from '@/modules/assets/api/assets'
import { indexAsset } from '@/modules/search/indexing/indexAsset'
import { runKnowledgeExtractionFromContent } from '@/modules/knowledge-intelligence/api/knowledgeExtraction'
import { runDocumentIntelligenceFromContent } from '@/modules/processing/documentIntelligence/runDocumentIntelligence'
import type { Asset, AssetAnalysis } from '@/shared/types/database'

/**
 * Multimodal Intelligence v1/v2 — "Analyze with NOVA" on an image, three
 * reused steps composed as one action (not split into separate
 * user-triggered steps, because unlike a document — which already has
 * full-text search/RAG value before any knowledge extraction — an image
 * has none until it's been analyzed):
 *
 * 1. The vision call (mirrors useGenerateConversationTitle's
 *    withProviderAvailability/runWithFallback composition).
 * 2. runKnowledgeExtractionFromContent (v1) — the same chain Document
 *    Detail's "Extract Knowledge" button uses, sourceType: 'asset'.
 * 3. runDocumentIntelligenceFromContent (v2) — the exact same
 *    capability/parser Document Intelligence uses for documents, applied
 *    to this asset's analyzed text, merged into assets.metadata (analyzeImage
 *    itself only sets documentIntelligence: null; this step fills it in).
 *
 * Then indexAsset (v2) makes the analyzed text searchable — closing "OCR
 * output must become searchable knowledge," not stored as dead text.
 *
 * PIP Sprint 8/10 — the vision call (step 1) is the expensive, valuable
 * result; steps 2/3 are enrichments. Previously, `updateAssetMetadata`
 * only ran after all three steps succeeded, so a step-2/3 failure (a
 * genuine provider failure, unlike their own sparse-content handling —
 * see their "fewer than 2 nodes" / empty-array cases, which don't throw)
 * discarded a real, successfully-completed vision analysis: the image was
 * left looking exactly as if "Analyze with NOVA" had never been run,
 * forcing a full (costly) retry to get back a result already computed.
 * Now the core analysis is persisted as soon as it succeeds; extraction
 * and document intelligence are best-effort — a failure in either is
 * logged and the mutation still succeeds with whatever did complete,
 * rather than discarding the vision result underneath it.
 */
export function useAnalyzeImage() {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()
  const queryClient = useQueryClient()
  const providerId = useDefaultChatProviderId()
  // PIP Multimodal Intelligence Stabilization v1 — requireVision excludes
  // any provider explicitly marked text-only from image-analysis routing.
  // Every provider registered today is vision-capable (coreModule.ts), so
  // this is currently a no-op in practice; it exists so a future text-only
  // provider is excluded by construction rather than by a special case
  // someone has to remember to add here.
  const chain = useProviderChain(providerId, { requireVision: true })

  return useMutation({
    mutationFn: async (asset: Pick<Asset, 'id' | 'optimized_path' | 'title'>): Promise<AssetAnalysis> => {
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

      // Persisted immediately: this is the real, valuable result, and
      // must survive even if an enrichment step below fails.
      await updateAssetMetadata(asset.id, analysis)

      const content = analysis.extractedText ? `${analysis.description}\n\nVisible text: ${analysis.extractedText}` : analysis.description

      try {
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
      } catch (err) {
        console.error(`Knowledge extraction failed for asset ${asset.id} — the image analysis itself is unaffected:`, err)
      }

      let documentIntelligence: AssetAnalysis['documentIntelligence'] = null
      try {
        documentIntelligence = await withProviderAvailability(
          chain,
          () => runDocumentIntelligenceFromContent({ content, userId: user!.id, workspaceId: currentWorkspaceId, chain }),
          { queryClient },
        )
      } catch (err) {
        console.error(`Document intelligence failed for asset ${asset.id} — the image analysis itself is unaffected:`, err)
      }

      const finalAnalysis: AssetAnalysis = { ...analysis, documentIntelligence }
      await updateAssetMetadata(asset.id, finalAnalysis)

      void indexAsset({ assetId: asset.id, title: asset.title, metadata: finalAnalysis, userId: user!.id, workspaceId: currentWorkspaceId })

      return finalAnalysis
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['assets'] })
      void queryClient.invalidateQueries({ queryKey: ['asset-detail'] })
      void queryClient.invalidateQueries({ queryKey: ['knowledge-nodes'] })
      void queryClient.invalidateQueries({ queryKey: ['knowledge-edges'] })
      void queryClient.invalidateQueries({ queryKey: ['knowledge-insights'] })
      void queryClient.invalidateQueries({ queryKey: ['knowledge-map'] })
    },
  })
}
