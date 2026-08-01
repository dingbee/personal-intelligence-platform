import { supabase } from '@/shared/lib/supabase'
import type { SearchProvider, SearchQuery, SearchResult } from '@/modules/search/types'
import { LEXICAL_ONLY_BASE_SCORE, applyLexicalBoost } from '@/modules/search/ranking/hybridScore'

export const documentSearchProvider: SearchProvider = {
  id: 'document',

  async search(query: SearchQuery): Promise<SearchResult[]> {
    let lexicalQuery = supabase.from('documents').select('id, title, updated_at').ilike('title', `%${query.queryText}%`).limit(query.matchCount)
    if (query.workspaceId) lexicalQuery = lexicalQuery.eq('workspace_id', query.workspaceId)

    const [semanticResult, lexicalResult] = await Promise.all([
      supabase.rpc('match_document_chunks', {
        query_embedding: query.queryEmbedding,
        match_count: query.matchCount,
        filter_workspace_id: query.workspaceId,
      }),
      lexicalQuery,
    ])
    if (semanticResult.error) throw semanticResult.error
    if (lexicalResult.error) throw lexicalResult.error

    const semanticRows = semanticResult.data
    const lexicalDocs = lexicalResult.data
    if (semanticRows.length === 0 && lexicalDocs.length === 0) return []

    const semanticOnlyIds = Array.from(new Set(semanticRows.map((row) => row.document_id))).filter(
      (id) => !lexicalDocs.some((doc) => doc.id === id),
    )
    const { data: extraDocuments, error: extraDocumentsError } =
      semanticOnlyIds.length > 0
        ? await supabase.from('documents').select('id, title, updated_at').in('id', semanticOnlyIds)
        : { data: [], error: null }
    if (extraDocumentsError) throw extraDocumentsError
    const documentById = new Map([...lexicalDocs, ...extraDocuments].map((doc) => [doc.id, doc]))
    const lexicalIds = new Set(lexicalDocs.map((doc) => doc.id))

    // UX-13.11 Phase 3 — hybrid semantic + lexical: an exact/partial title
    // match boosts a document that also matched semantically, and lets a
    // document surface purely on title even if the embedding model didn't
    // score it highly for this query (e.g. an unusual proper noun).
    const results: SearchResult[] = semanticRows.map((row) => ({
      sourceType: 'document',
      sourceId: row.document_id,
      title: documentById.get(row.document_id)?.title ?? 'Untitled document',
      snippet: row.content,
      similarity: applyLexicalBoost(row.similarity, lexicalIds.has(row.document_id)),
      href: `/library/${row.document_id}/read`,
      updatedAt: documentById.get(row.document_id)?.updated_at,
    }))

    const semanticIds = new Set(semanticRows.map((row) => row.document_id))
    for (const doc of lexicalDocs) {
      if (semanticIds.has(doc.id)) continue
      results.push({
        sourceType: 'document',
        sourceId: doc.id,
        title: doc.title,
        snippet: 'Matched by document title.',
        similarity: LEXICAL_ONLY_BASE_SCORE,
        href: `/library/${doc.id}/read`,
        updatedAt: doc.updated_at,
      })
    }

    return results
  },
}
