import { useState } from 'react'
import { useAuth } from '@/modules/auth/useAuth'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { runUniversalSearch } from '@/modules/search/runUniversalSearch'
import type { SearchResult } from '@/modules/search/types'

export function useSearch() {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function search(queryText: string) {
    if (!queryText.trim()) {
      setResults([])
      return
    }

    setLoading(true)
    setError(null)
    try {
      const searchResults = await runUniversalSearch({ queryText, userId: user!.id, workspaceId: currentWorkspaceId })
      setResults(searchResults)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  return { search, results, loading, error }
}
