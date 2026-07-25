export interface SearchResult {
  /** e.g. 'document', 'conversation' — later: 'note', 'highlight', 'flashcard'. */
  sourceType: string
  sourceId: string
  title: string
  snippet: string
  similarity: number
  href: string
}

export interface SearchQuery {
  queryEmbedding: number[]
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
