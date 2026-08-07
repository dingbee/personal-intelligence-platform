import { supabase } from '@/shared/lib/supabase'
import { OpenAIEmbeddingProvider } from '@/modules/ai/embeddings/OpenAIEmbeddingProvider'
import type { AssetAnalysis } from '@/shared/types/database'

const embeddingProvider = new OpenAIEmbeddingProvider()

/**
 * Multimodal Intelligence v2 — same fire-and-forget contract as
 * indexNote/indexMessage: called after "Analyze with NOVA" completes,
 * swallows its own errors, never blocks the UI on a failed index.
 * Mirrors note_embeddings/match_notes exactly (0025_note_search.sql),
 * scoped to assets (0039_asset_search.sql). An asset with no analysis yet
 * has nothing worth embedding — the title alone isn't enough to justify
 * an embeddings row, since a search hit with no real content behind it
 * would be worse than no hit — so indexing only happens once analysis
 * has actually produced a description/extractedText. This is what closes
 * "OCR output must become searchable knowledge. Do not store OCR as dead
 * text." — no second indexing mechanism, same embeddings table pattern
 * every other source type already uses.
 */
export async function indexAsset(params: {
  assetId: string
  title: string
  metadata: AssetAnalysis | null
  userId: string
  workspaceId: string | null
}): Promise<void> {
  if (!params.metadata) return
  const text = [params.title, params.metadata.description, params.metadata.extractedText]
    .filter((part): part is string => Boolean(part && part.trim().length > 0))
    .join('\n\n')
  if (!text.trim()) return

  try {
    const [embedding] = await embeddingProvider.embed([text], {
      userId: params.userId,
      workspaceId: params.workspaceId,
      feature: 'indexing',
    })
    const { error } = await supabase
      .from('asset_embeddings')
      .upsert(
        { asset_id: params.assetId, model: embeddingProvider.modelName, embedding: embedding! },
        { onConflict: 'asset_id' },
      )
    if (error) throw error
  } catch (err) {
    console.error(`Failed to index asset ${params.assetId} for search:`, err)
  }
}
