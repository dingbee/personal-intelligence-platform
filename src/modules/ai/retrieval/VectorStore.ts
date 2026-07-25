export interface VectorMatch {
  chunkId: string
  documentId: string
  content: string
  similarity: number
}

export interface VectorQueryOptions {
  matchCount?: number
  /** Scope the search to one document ("chat about this book") instead of the user's whole library. */
  documentId?: string
  /** null/omitted = every workspace (matches the rest of the app's "All workspaces" convention). */
  workspaceId?: string | null
}

export interface VectorStore {
  upsert(entries: { chunkId: string; embedding: number[]; model: string }[]): Promise<void>
  query(embedding: number[], options?: VectorQueryOptions): Promise<VectorMatch[]>
}
