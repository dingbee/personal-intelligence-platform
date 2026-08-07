import { supabase } from '@/shared/lib/supabase'
import type { SearchProvider, SearchQuery, SearchResult } from '@/modules/search/types'
import { LEXICAL_ONLY_BASE_SCORE } from '@/modules/search/ranking/hybridScore'

/**
 * Knowledge Intelligence Layer v1, Feature 7 — closes the "two silos" gap
 * the discovery audit found: searchKnowledgeConcepts.ts already does a
 * title-ILIKE lookup over knowledge_nodes, but runs alongside
 * runUniversalSearch as a second call, never merged into its one ranked
 * list. This registers the same lookup as a real SearchProvider so concept
 * results are ranked, sorted, and displayed exactly like every other
 * source instead of a separate section. No semantic search here — nodes
 * deliberately have no embedding column of their own (see knowledgeMap.ts's
 * own comment on that design choice) — so every result is lexical-only,
 * same LEXICAL_ONLY_BASE_SCORE fallback score notesSearchProvider uses
 * when it has no semantic match either.
 */
export const conceptSearchProvider: SearchProvider = {
  id: 'concept',

  async search(query: SearchQuery): Promise<SearchResult[]> {
    let lexicalQuery = supabase
      .from('knowledge_nodes')
      .select('id, title, description, updated_at')
      .ilike('title', `%${query.queryText}%`)
      .limit(query.matchCount)
    if (query.workspaceId) lexicalQuery = lexicalQuery.eq('workspace_id', query.workspaceId)

    const { data, error } = await lexicalQuery
    if (error) throw error

    return data.map((row) => ({
      sourceType: 'concept',
      sourceId: row.id,
      title: row.title,
      snippet: row.description ?? '',
      similarity: LEXICAL_ONLY_BASE_SCORE,
      href: `/knowledge/nodes/${row.id}`,
      updatedAt: row.updated_at,
    }))
  },
}
