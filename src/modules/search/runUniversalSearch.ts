import { OpenAIEmbeddingProvider } from '@/modules/ai/embeddings/OpenAIEmbeddingProvider'
import { searchProviderRegistry } from '@/modules/search/registry'
import type { SearchResult } from '@/modules/search/types'

const embeddingProvider = new OpenAIEmbeddingProvider()

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

  return bySource.flat().sort((a, b) => b.similarity - a.similarity)
}
