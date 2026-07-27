import { useState } from 'react'
import { useAuth } from '@/modules/auth/useAuth'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { linkResolverRegistry } from '@/modules/knowledgeLinks/registry'
import type { LinkableItem, LinkableType } from '@/modules/knowledgeLinks/types'

/** Cross-type search for the "add link" picker — excludes the node being linked from. */
export function useLinkableSearch(excludeType: LinkableType, excludeId: string) {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()
  const [results, setResults] = useState<LinkableItem[]>([])
  const [loading, setLoading] = useState(false)

  async function search(queryText: string) {
    const trimmed = queryText.trim()
    if (!trimmed) {
      setResults([])
      return
    }

    setLoading(true)
    try {
      const resolvers = linkResolverRegistry.list()
      const byResolver = await Promise.all(
        resolvers.map((resolver) =>
          resolver.search(trimmed, { userId: user!.id, workspaceId: currentWorkspaceId }).catch((err) => {
            console.error(`Link resolver "${resolver.id}" search failed:`, err)
            return []
          }),
        ),
      )
      setResults(byResolver.flat().filter((item) => !(item.type === excludeType && item.id === excludeId)))
    } finally {
      setLoading(false)
    }
  }

  return { search, results, loading }
}
