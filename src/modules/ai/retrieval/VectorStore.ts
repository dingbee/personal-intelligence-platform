export interface VectorMatch {
  chunkId: string
  documentId: string
  content: string
  similarity: number
}

export interface VectorStore {
  upsert(entries: { chunkId: string; embedding: number[]; model: string }[]): Promise<void>
  query(embedding: number[], matchCount?: number): Promise<VectorMatch[]>
}
