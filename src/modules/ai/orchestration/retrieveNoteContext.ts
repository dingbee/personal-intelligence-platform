import { supabase } from '@/shared/lib/supabase'
import { OpenAIEmbeddingProvider } from '@/modules/ai/embeddings/OpenAIEmbeddingProvider'
import { extractLexicalSearchTerms } from '@/modules/ai/orchestration/extractLexicalSearchTerms'
import { LEXICAL_ONLY_BASE_SCORE, applyLexicalBoost } from '@/modules/search/ranking/hybridScore'

const embeddingProvider = new OpenAIEmbeddingProvider()
const SEMANTIC_MATCH_COUNT = 5
// PIP Sprint 7/10 — same bounding rationale as retrieveContext's
// MAX_LEXICAL_ONLY_ADDITIONS: a common word extracted as a "term" can't
// flood the context with low-value note matches.
const MAX_LEXICAL_ONLY_ADDITIONS = 3
const MAX_ROWS_PER_TERM = 5

export interface NoteContextMatch {
  noteId: string
  title: string
  content: string
  similarity: number
}

/**
 * PIP Sprint 7/10 — the chat-context counterpart of retrieveContext, for
 * notes. Reuses `match_notes` (built for Universal Search's
 * notesSearchProvider, UX-13.11 Phase 1) rather than inventing a second
 * embedding/similarity mechanism — this is the central finding of the
 * sprint's discovery: notes have had full hybrid semantic+lexical search
 * for two sprints, but chat's own retrieval path never queried them, so a
 * fact written only in a note was unreachable from chat unless a
 * knowledge-graph node for it happened to already exist from some other
 * source. Follows retrieveContext's exact hybrid pattern (lexical content
 * search boosts/supplements semantic results) rather than
 * notesSearchProvider's title-only lexical fallback, because chat needs to
 * find the passage that mentions a rare term, not just a note whose title
 * happens to match.
 */
export async function retrieveNoteContext(params: {
  query: string
  userId: string
  workspaceId: string | null
  /** PIP Sprint 9/10 — see retrieveContext.ts's identical param: shared with retrieveContext/retrieveAssetContext so the same query text is embedded once per turn, not three times. Falls back to embedding internally when omitted. */
  embedding?: number[]
}): Promise<NoteContextMatch[]> {
  const embedding =
    params.embedding ??
    (
      await embeddingProvider.embed([params.query], {
        userId: params.userId,
        workspaceId: params.workspaceId,
        feature: 'retrieval',
      })
    )[0]!

  const lexicalTerms = extractLexicalSearchTerms(params.query)
  // PIP Sprint 9/10 — same independent-concurrency reasoning as
  // retrieveContext.ts: semantic (match_notes RPC) and lexical (content
  // ILIKE) search don't depend on each other's result.
  const [semanticResult, lexicalMatches] = await Promise.all([
    supabase.rpc('match_notes', { query_embedding: embedding, match_count: SEMANTIC_MATCH_COUNT, filter_workspace_id: params.workspaceId }),
    lexicalTerms.length > 0 ? searchNotesByLexicalTerms(lexicalTerms, params.workspaceId).catch(() => [] as NoteContextMatch[]) : Promise.resolve([] as NoteContextMatch[]),
  ])
  const { data: semanticRows, error } = semanticResult
  if (error) throw error

  const semanticMatches: NoteContextMatch[] = semanticRows.map((row) => ({
    noteId: row.note_id,
    title: row.title || 'Untitled note',
    content: row.content,
    similarity: row.similarity,
  }))

  if (lexicalTerms.length === 0 || lexicalMatches.length === 0) return semanticMatches

  const lexicalNoteIds = new Set(lexicalMatches.map((m) => m.noteId))
  const boosted = semanticMatches.map((match) =>
    lexicalNoteIds.has(match.noteId) ? { ...match, similarity: applyLexicalBoost(match.similarity, true) } : match,
  )

  const semanticNoteIds = new Set(semanticMatches.map((m) => m.noteId))
  const lexicalOnly = lexicalMatches
    .filter((m) => !semanticNoteIds.has(m.noteId))
    .slice(0, MAX_LEXICAL_ONLY_ADDITIONS)
    .map((m) => ({ ...m, similarity: LEXICAL_ONLY_BASE_SCORE }))

  return [...boosted, ...lexicalOnly].sort((a, b) => b.similarity - a.similarity)
}

/** Mirrors lexicalChunkSearch.ts's shape exactly (one query per term, run in parallel), against note content rather than document_chunks. */
async function searchNotesByLexicalTerms(terms: string[], workspaceId: string | null): Promise<NoteContextMatch[]> {
  const rows = await Promise.all(
    terms.map(async (term) => {
      const escaped = term.replace(/[%_]/g, '\\$&')
      let query = supabase.from('notes').select('id, title, content').ilike('content', `%${escaped}%`).limit(MAX_ROWS_PER_TERM)
      if (workspaceId) query = query.eq('workspace_id', workspaceId)

      const { data, error } = await query
      if (error) throw error
      return data
    }),
  )

  const byNoteId = new Map<string, NoteContextMatch>()
  for (const row of rows.flat()) {
    if (!byNoteId.has(row.id)) {
      byNoteId.set(row.id, { noteId: row.id, title: row.title || 'Untitled note', content: row.content, similarity: 0 })
    }
  }
  return [...byNoteId.values()]
}
