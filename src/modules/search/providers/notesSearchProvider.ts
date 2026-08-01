import { supabase } from '@/shared/lib/supabase'
import type { SearchProvider, SearchQuery, SearchResult } from '@/modules/search/types'
import { LEXICAL_ONLY_BASE_SCORE, applyLexicalBoost } from '@/modules/search/ranking/hybridScore'

export const notesSearchProvider: SearchProvider = {
  id: 'note',

  async search(query: SearchQuery): Promise<SearchResult[]> {
    let lexicalQuery = supabase.from('notes').select('id, title, content, updated_at').ilike('title', `%${query.queryText}%`).limit(query.matchCount)
    if (query.workspaceId) lexicalQuery = lexicalQuery.eq('workspace_id', query.workspaceId)

    const [semanticResult, lexicalResult] = await Promise.all([
      supabase.rpc('match_notes', {
        query_embedding: query.queryEmbedding,
        match_count: query.matchCount,
        filter_workspace_id: query.workspaceId,
      }),
      lexicalQuery,
    ])
    if (semanticResult.error) throw semanticResult.error
    if (lexicalResult.error) throw lexicalResult.error

    const semanticRows = semanticResult.data
    const lexicalNotes = lexicalResult.data
    if (semanticRows.length === 0 && lexicalNotes.length === 0) return []

    // match_notes doesn't return updated_at — fetched for the semantic-only
    // rows so runUniversalSearch can apply the same recency bonus every
    // source gets (UX-13.11 Phase 3), the same pattern documentSearchProvider
    // uses.
    const semanticOnlyIds = Array.from(new Set(semanticRows.map((row) => row.note_id))).filter(
      (id) => !lexicalNotes.some((note) => note.id === id),
    )
    const { data: extraNotes, error: extraNotesError } =
      semanticOnlyIds.length > 0 ? await supabase.from('notes').select('id, updated_at').in('id', semanticOnlyIds) : { data: [], error: null }
    if (extraNotesError) throw extraNotesError
    const updatedAtById = new Map<string, string>([
      ...lexicalNotes.map((note): [string, string] => [note.id, note.updated_at]),
      ...extraNotes.map((note): [string, string] => [note.id, note.updated_at]),
    ])
    const lexicalIds = new Set(lexicalNotes.map((note) => note.id))

    const results: SearchResult[] = semanticRows.map((row) => ({
      sourceType: 'note',
      sourceId: row.note_id,
      title: row.title || 'Untitled note',
      snippet: row.content,
      similarity: applyLexicalBoost(row.similarity, lexicalIds.has(row.note_id)),
      href: `/notes/${row.note_id}`,
      updatedAt: updatedAtById.get(row.note_id),
    }))

    const semanticIds = new Set(semanticRows.map((row) => row.note_id))
    for (const note of lexicalNotes) {
      if (semanticIds.has(note.id)) continue
      results.push({
        sourceType: 'note',
        sourceId: note.id,
        title: note.title || 'Untitled note',
        snippet: note.content,
        similarity: LEXICAL_ONLY_BASE_SCORE,
        href: `/notes/${note.id}`,
        updatedAt: note.updated_at,
      })
    }

    return results
  },
}
