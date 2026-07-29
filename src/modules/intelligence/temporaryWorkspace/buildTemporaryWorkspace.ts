import { runUniversalSearch } from '@/modules/search/runUniversalSearch'
import type { SearchResult } from '@/modules/search/types'
import type { TemporaryWorkspace, TemporaryWorkspaceItem } from '@/modules/intelligence/temporaryWorkspace/types'

function toItem(result: SearchResult): TemporaryWorkspaceItem {
  return { sourceType: result.sourceType, sourceId: result.sourceId, title: result.title, href: result.href }
}

/**
 * Pure grouping, exported separately for direct unit testing. Dedupes by
 * (sourceType, sourceId) — the same document/conversation can surface
 * from more than one matched chunk — keeping whichever hit had the
 * highest similarity.
 */
export function groupSearchResultsIntoTemporaryWorkspace(topic: string, results: SearchResult[]): TemporaryWorkspace {
  const bestBySourceKey = new Map<string, SearchResult>()
  for (const result of results) {
    const key = `${result.sourceType}:${result.sourceId}`
    const existing = bestBySourceKey.get(key)
    if (!existing || result.similarity > existing.similarity) bestBySourceKey.set(key, result)
  }

  const deduped = [...bestBySourceKey.values()]
  return {
    topic,
    documents: deduped.filter((result) => result.sourceType === 'document').map(toItem),
    conversations: deduped.filter((result) => result.sourceType === 'conversation').map(toItem),
    createdAt: new Date().toISOString(),
  }
}

/**
 * UX-7 Phase 7 — builds a temporary, in-memory-only workspace for a topic
 * ("Collect everything about Marketing"). Reuses runUniversalSearch, the
 * exact same semantic search SearchPage already runs — not a new
 * retrieval mechanism. "No database schema" is satisfied by never
 * persisting the result, not by avoiding existing search infrastructure.
 */
export async function buildTemporaryWorkspace(params: {
  topic: string
  userId: string
  workspaceId: string | null
}): Promise<TemporaryWorkspace> {
  const results = await runUniversalSearch({
    queryText: params.topic,
    userId: params.userId,
    workspaceId: params.workspaceId,
  })
  return groupSearchResultsIntoTemporaryWorkspace(params.topic, results)
}
