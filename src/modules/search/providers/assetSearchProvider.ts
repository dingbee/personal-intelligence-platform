import { supabase } from '@/shared/lib/supabase'
import type { SearchProvider, SearchQuery, SearchResult } from '@/modules/search/types'
import { LEXICAL_ONLY_BASE_SCORE, applyLexicalBoost } from '@/modules/search/ranking/hybridScore'
import type { AssetAnalysis } from '@/shared/types/database'

/** Assets have no updated_at column — created_at is the only timestamp available, used the same way notesSearchProvider uses updated_at. */
function snippetFor(metadata: AssetAnalysis | null): string {
  if (!metadata) return ''
  return metadata.extractedText ? `${metadata.description}\n\n${metadata.extractedText}` : metadata.description
}

/**
 * Multimodal Intelligence v2 — the fourth Universal Search source,
 * mirroring notesSearchProvider's hybrid semantic+lexical shape exactly.
 * Only assets with a completed "Analyze with NOVA" pass (assets.metadata
 * set, asset_embeddings row indexed — see indexAsset.ts) are reachable
 * here via semantic search; an unanalyzed asset can still surface via the
 * lexical title match, same as any other source with sparse content.
 */
export const assetSearchProvider: SearchProvider = {
  id: 'asset',

  async search(query: SearchQuery): Promise<SearchResult[]> {
    let lexicalQuery = supabase
      .from('assets')
      .select('id, title, metadata, created_at')
      .ilike('title', `%${query.queryText}%`)
      .limit(query.matchCount)
    if (query.workspaceId) lexicalQuery = lexicalQuery.eq('workspace_id', query.workspaceId)

    const [semanticResult, lexicalResult] = await Promise.all([
      supabase.rpc('match_assets', {
        query_embedding: query.queryEmbedding,
        match_count: query.matchCount,
        filter_workspace_id: query.workspaceId,
      }),
      lexicalQuery,
    ])
    if (semanticResult.error) throw semanticResult.error
    if (lexicalResult.error) throw lexicalResult.error

    const semanticRows = semanticResult.data
    const lexicalAssets = lexicalResult.data
    if (semanticRows.length === 0 && lexicalAssets.length === 0) return []

    // match_assets doesn't return metadata/created_at — fetched for the
    // semantic-only rows so a snippet can be shown, same pattern
    // notesSearchProvider/documentSearchProvider already use for their
    // own extra fields.
    const semanticOnlyIds = Array.from(new Set(semanticRows.map((row) => row.asset_id))).filter(
      (id) => !lexicalAssets.some((asset) => asset.id === id),
    )
    const { data: extraAssets, error: extraAssetsError } =
      semanticOnlyIds.length > 0
        ? await supabase.from('assets').select('id, metadata, created_at').in('id', semanticOnlyIds)
        : { data: [], error: null }
    if (extraAssetsError) throw extraAssetsError

    type AssetDetails = { metadata: AssetAnalysis | null; createdAt: string }
    const detailsById = new Map<string, AssetDetails>([
      ...lexicalAssets.map((asset): [string, AssetDetails] => [asset.id, { metadata: asset.metadata, createdAt: asset.created_at }]),
      ...extraAssets.map((asset): [string, AssetDetails] => [asset.id, { metadata: asset.metadata, createdAt: asset.created_at }]),
    ])
    const lexicalIds = new Set(lexicalAssets.map((asset) => asset.id))

    const results: SearchResult[] = semanticRows.map((row) => {
      const details = detailsById.get(row.asset_id)
      return {
        sourceType: 'asset',
        sourceId: row.asset_id,
        title: row.title || 'Untitled image',
        snippet: snippetFor(details?.metadata ?? null),
        similarity: applyLexicalBoost(row.similarity, lexicalIds.has(row.asset_id)),
        href: `/library/assets/${row.asset_id}`,
        updatedAt: details?.createdAt,
      }
    })

    const semanticIds = new Set(semanticRows.map((row) => row.asset_id))
    for (const asset of lexicalAssets) {
      if (semanticIds.has(asset.id)) continue
      results.push({
        sourceType: 'asset',
        sourceId: asset.id,
        title: asset.title || 'Untitled image',
        snippet: snippetFor(asset.metadata),
        similarity: LEXICAL_ONLY_BASE_SCORE,
        href: `/library/assets/${asset.id}`,
        updatedAt: asset.created_at,
      })
    }

    return results
  },
}
