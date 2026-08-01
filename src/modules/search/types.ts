export interface SearchResult {
  /** e.g. 'document', 'conversation' — later: 'note', 'highlight', 'flashcard'. */
  sourceType: string
  sourceId: string
  title: string
  snippet: string
  similarity: number
  href: string
  /**
   * UX-13.11 Phase 2A — optional richer metadata, populated by providers
   * that group multiple underlying rows into one result (conversations
   * grouping messages today). Absent for providers with no equivalent
   * concept; SearchResultCard renders it only when present.
   */
  matchCount?: number
  updatedAt?: string
  workspaceId?: string | null
}

export interface SearchQuery {
  queryEmbedding: number[]
  /** UX-13.11 Phase 3 — the raw query text, alongside its embedding, so a provider can run a lexical (ILIKE) fallback query next to its semantic one. */
  queryText: string
  userId: string
  workspaceId: string | null
  matchCount: number
}

/**
 * A pluggable knowledge source for universal search. A future source type
 * (notes, highlights, flashcards) adds its own embeddings table + match
 * function, implements this interface, and registers itself — search's
 * aggregation logic (modules/search/hooks/useSearch.ts) never changes.
 */
export interface SearchProvider {
  /** Also the source type used in SearchResult.sourceType — named `id` to match createRegistry's `{ id: string }` constraint. */
  id: string
  search(query: SearchQuery): Promise<SearchResult[]>
}
