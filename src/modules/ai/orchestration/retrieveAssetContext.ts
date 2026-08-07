import { supabase } from '@/shared/lib/supabase'
import { OpenAIEmbeddingProvider } from '@/modules/ai/embeddings/OpenAIEmbeddingProvider'
import { buildAssetContextContent } from '@/modules/ai/orchestration/buildAssetContextContent'
import type { AssetAnalysis } from '@/shared/types/database'

const embeddingProvider = new OpenAIEmbeddingProvider()
const MATCH_COUNT = 5

export interface AssetContextMatch {
  assetId: string
  title: string
  content: string
  similarity: number
}

/**
 * PIP Stabilization v1 (P0, root cause A) — the chat-context counterpart
 * of retrieveContext, for images. Reuses `match_assets` (built in
 * Multimodal Intelligence v2, already powering Universal Search) rather
 * than inventing a second embedding/similarity mechanism — this is the
 * one place that RPC now also feeds live chat, not just the standalone
 * Search page. Assets with no analysis yet (metadata null) can't match —
 * there's nothing indexed for them (see indexAsset.ts's own "skip when
 * there's no real content yet" contract) — so this never fabricates
 * content for an unanalyzed image; it simply finds nothing, same as an
 * unindexed document would.
 */
export async function retrieveAssetContext(params: {
  query: string
  userId: string
  workspaceId: string | null
}): Promise<AssetContextMatch[]> {
  const [embedding] = await embeddingProvider.embed([params.query], {
    userId: params.userId,
    workspaceId: params.workspaceId,
    feature: 'retrieval',
  })

  const { data: rows, error } = await supabase.rpc('match_assets', {
    query_embedding: embedding!,
    match_count: MATCH_COUNT,
    filter_workspace_id: params.workspaceId,
  })
  if (error) throw error
  if (rows.length === 0) return []

  const assetIds = rows.map((row) => row.asset_id)
  const { data: assets, error: assetsError } = await supabase.from('assets').select('id, title, metadata').in('id', assetIds)
  if (assetsError) throw assetsError
  const byId = new Map(assets.map((asset) => [asset.id, asset]))

  const matches: AssetContextMatch[] = []
  for (const row of rows) {
    const asset = byId.get(row.asset_id)
    if (!asset?.metadata) continue
    matches.push({
      assetId: row.asset_id,
      title: asset.title,
      content: buildAssetContextContent(asset.title, asset.metadata as AssetAnalysis),
      similarity: row.similarity,
    })
  }
  return matches
}
