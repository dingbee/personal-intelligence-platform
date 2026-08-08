import { supabase } from '@/shared/lib/supabase'

const MAX_ROWS_PER_TERM = 5

/** Escapes ILIKE wildcard characters so a literal '%' or '_' in a search term isn't treated as a pattern wildcard. */
function escapeIlike(term: string): string {
  return term.replace(/[%_]/g, (char) => `\\${char}`)
}

export interface LexicalChunkMatch {
  chunkId: string
  documentId: string
  content: string
}

/**
 * PIP Sprint 4/10 — literal substring search over document_chunks.content,
 * the exact-match counterpart to the pure vector similarity
 * match_document_chunks already does. Reuses the authenticated Supabase
 * client directly (same pattern documentSearchProvider.ts already
 * established for a title ILIKE fallback) so the existing "Document chunk
 * visibility follows workspace membership" RLS policy on document_chunks
 * enforces the exact same ownership/sharing boundary match_document_chunks
 * relies on — no new RPC, no parallel security predicate to keep in sync.
 *
 * One query per term (terms are typically 1-3 short entity-like tokens —
 * see extractLexicalSearchTerms.ts) rather than building an OR'd filter
 * string, since PostgREST's `.or()` syntax is fragile with the special
 * characters ("(", ",") a real search term can contain.
 */
export async function searchChunksByLexicalTerms(
  terms: string[],
  scope: { documentId?: string; workspaceId?: string | null },
): Promise<LexicalChunkMatch[]> {
  if (terms.length === 0) return []

  const rows = await Promise.all(
    terms.map(async (term) => {
      let query = supabase
        .from('document_chunks')
        .select('id, document_id, content')
        .ilike('content', `%${escapeIlike(term)}%`)
        .limit(MAX_ROWS_PER_TERM)
      if (scope.documentId) query = query.eq('document_id', scope.documentId)
      else if (scope.workspaceId) query = query.eq('workspace_id', scope.workspaceId)

      const { data, error } = await query
      if (error) throw error
      return data
    }),
  )

  const byChunkId = new Map<string, LexicalChunkMatch>()
  for (const row of rows.flat()) {
    if (!byChunkId.has(row.id)) {
      byChunkId.set(row.id, { chunkId: row.id, documentId: row.document_id, content: row.content })
    }
  }
  return [...byChunkId.values()]
}
