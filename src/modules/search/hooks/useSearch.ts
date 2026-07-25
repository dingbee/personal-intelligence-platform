import { useState } from 'react'
import { useAuth } from '@/modules/auth/useAuth'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { OpenAIEmbeddingProvider } from '@/modules/ai/embeddings/OpenAIEmbeddingProvider'
import { searchProviderRegistry } from '@/modules/search/registry'
import type { SearchResult } from '@/modules/search/types'

const embeddingProvider = new OpenAIEmbeddingProvider()
const MATCH_COUNT_PER_SOURCE = 10

export function useSearch() {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function search(queryText: string) {
    const trimmed = queryText.trim()
    if (!trimmed) {
      setResults([])
      return
    }

    setLoading(true)
    setError(null)
    try {
      const [queryEmbedding] = await embeddingProvider.embed([trimmed], {
        userId: user!.id,
        workspaceId: currentWorkspaceId,
        feature: 'search',
      })

      const providers = searchProviderRegistry.list()
      const bySource = await Promise.all(
        providers.map((provider) =>
          provider
            .search({
              queryEmbedding: queryEmbedding!,
              userId: user!.id,
              workspaceId: currentWorkspaceId,
              matchCount: MATCH_COUNT_PER_SOURCE,
            })
            // One source failing (e.g. no conversations indexed yet) shouldn't blank the whole search.
            .catch((err) => {
              console.error(`Search provider "${provider.id}" failed:`, err)
              return []
            }),
        ),
      )

      setResults(bySource.flat().sort((a, b) => b.similarity - a.similarity))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  return { search, results, loading, error }
}
