import { supabase } from '@/shared/lib/supabase'
import type { SearchProvider, SearchQuery, SearchResult } from '@/modules/search/types'

export const documentSearchProvider: SearchProvider = {
  id: 'document',

  async search(query: SearchQuery): Promise<SearchResult[]> {
    const { data, error } = await supabase.rpc('match_document_chunks', {
      query_embedding: query.queryEmbedding,
      match_count: query.matchCount,
      filter_workspace_id: query.workspaceId,
    })
    if (error) throw error
    if (data.length === 0) return []

    const documentIds = Array.from(new Set(data.map((row) => row.document_id)))
    const { data: documents, error: documentsError } = await supabase
      .from('documents')
      .select('id, title')
      .in('id', documentIds)
    if (documentsError) throw documentsError
    const titleById = new Map(documents.map((doc) => [doc.id, doc.title]))

    return data.map((row) => ({
      sourceType: 'document',
      sourceId: row.document_id,
      title: titleById.get(row.document_id) ?? 'Untitled document',
      snippet: row.content,
      similarity: row.similarity,
      href: `/library/${row.document_id}/read`,
    }))
  },
}
