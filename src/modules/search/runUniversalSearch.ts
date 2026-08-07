import { supabase } from '@/shared/lib/supabase'
import { OpenAIEmbeddingProvider } from '@/modules/ai/embeddings/OpenAIEmbeddingProvider'
import { searchProviderRegistry } from '@/modules/search/registry'
import { applyRecencyBonus } from '@/modules/search/ranking/crossProviderRelevance'
import { applyImportanceBonus } from '@/modules/search/ranking/importanceScore'
import type { SearchResult } from '@/modules/search/types'

const embeddingProvider = new OpenAIEmbeddingProvider()

/**
 * Knowledge Intelligence Layer v1, Feature 7 — how many distinct knowledge
 * nodes cite each result as evidence, keyed `${sourceType}:${sourceId}` so
 * a UUID collision across tables (astronomically unlikely, but the key
 * still disambiguates it) can never merge two different sources' counts.
 * `concept` results aren't looked up here — knowledge_node_sources records
 * what cites a *document/note/asset/conversation*, not what cites a
 * concept — so they're simply excluded from evidenceCounts and get no
 * importance bonus, exactly like a result with 0 citations.
 */
async function fetchEvidenceCounts(results: SearchResult[]): Promise<Map<string, number>> {
  const sourceIds = Array.from(new Set(results.filter((r) => r.sourceType !== 'concept').map((r) => r.sourceId)))
  if (sourceIds.length === 0) return new Map()

  const { data, error } = await supabase.from('knowledge_node_sources').select('source_type, source_id').in('source_id', sourceIds)
  if (error) throw error

  const counts = new Map<string, number>()
  for (const row of data) {
    const key = `${row.source_type}:${row.source_id}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

/**
 * The actual cross-source search — extracted out of useSearch (UX-7
 * Phase 7) so a non-hook caller (buildTemporaryWorkspace) can run the
 * exact same search, not a reimplementation of it. useSearch's `search()`
 * now just calls this and manages loading/error state around it.
 */
export async function runUniversalSearch(params: {
  queryText: string
  userId: string
  workspaceId: string | null
  matchCountPerSource?: number
}): Promise<SearchResult[]> {
  const trimmed = params.queryText.trim()
  if (!trimmed) return []

  const [queryEmbedding] = await embeddingProvider.embed([trimmed], {
    userId: params.userId,
    workspaceId: params.workspaceId,
    feature: 'search',
  })

  const providers = searchProviderRegistry.list()
  const bySource = await Promise.all(
    providers.map((provider) =>
      provider
        .search({
          queryEmbedding: queryEmbedding!,
          queryText: trimmed,
          userId: params.userId,
          workspaceId: params.workspaceId,
          matchCount: params.matchCountPerSource ?? 10,
        })
        // One source failing (e.g. no conversations indexed yet) shouldn't blank the whole search.
        .catch((err) => {
          console.error(`Search provider "${provider.id}" failed:`, err)
          return []
        }),
    ),
  )

  const flattened = bySource.flat()

  // Knowledge Intelligence Layer v1, Feature 7 — "importance" (evidence
  // count) is applied the same uniform way recency already is: computed
  // once here, after each provider's own scoring, never inside a provider.
  const evidenceCounts = await fetchEvidenceCounts(flattened).catch((err: unknown) => {
    console.error('Failed to fetch evidence counts for search importance ranking:', err)
    return new Map<string, number>()
  })

  // Cross-provider ranking refinement (UX-13.11 Phase 3): recency is applied
  // once, uniformly, here — after each provider's own source-specific
  // scoring (e.g. conversations' support bonus) — so a fresh document and a
  // fresh conversation get the same treatment instead of only conversations
  // ever having had a recency signal.
  const results = flattened.map((result) => {
    const withRecency = applyRecencyBonus(result.similarity, result.updatedAt)
    const evidenceCount = evidenceCounts.get(`${result.sourceType}:${result.sourceId}`)
    return { ...result, similarity: applyImportanceBonus(withRecency, evidenceCount) }
  })

  return results.sort((a, b) => b.similarity - a.similarity)
}
