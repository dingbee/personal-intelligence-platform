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
}

export interface VectorStore {
  upsert(entries: { chunkId: string; embedding: number[]; model: string }[]): Promise<void>
  query(embedding: number[], options?: VectorQueryOptions): Promise<VectorMatch[]>
}
