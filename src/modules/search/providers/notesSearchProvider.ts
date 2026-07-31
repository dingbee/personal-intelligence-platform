import { supabase } from '@/shared/lib/supabase'
import type { SearchProvider, SearchQuery, SearchResult } from '@/modules/search/types'

export const notesSearchProvider: SearchProvider = {
  id: 'note',

  async search(query: SearchQuery): Promise<SearchResult[]> {
    const { data, error } = await supabase.rpc('match_notes', {
      query_embedding: query.queryEmbedding,
      match_count: query.matchCount,
      filter_workspace_id: query.workspaceId,
    })
    if (error) throw error

    return data.map((row) => ({
      sourceType: 'note',
      sourceId: row.note_id,
      title: row.title || 'Untitled note',
      snippet: row.content,
      similarity: row.similarity,
      href: `/notes/${row.note_id}`,
    }))
  },
}
