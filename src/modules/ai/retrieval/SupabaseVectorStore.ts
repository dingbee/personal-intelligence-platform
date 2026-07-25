import { supabase } from '@/shared/lib/supabase'
import type { VectorMatch, VectorStore } from '@/modules/ai/retrieval/VectorStore'

/**
 * Storage and similarity search are mechanically real (pgvector cosine
 * distance via the `match_document_chunks` SQL function). Result quality
 * depends entirely on which EmbeddingProvider produced the vectors — this
 * store doesn't care.
 */
export const supabaseVectorStore: VectorStore = {
  async upsert(entries) {
    if (entries.length === 0) return
    const { error } = await supabase.from('embeddings').upsert(
      entries.map((entry) => ({
        chunk_id: entry.chunkId,
        model: entry.model,
        embedding: entry.embedding,
      })),
      { onConflict: 'chunk_id' },
    )
    if (error) throw error
  },

  async query(embedding, options = {}): Promise<VectorMatch[]> {
    const { data, error } = await supabase.rpc('match_document_chunks', {
      query_embedding: embedding,
      match_count: options.matchCount ?? 10,
      filter_document_id: options.documentId ?? null,
      filter_workspace_id: options.workspaceId ?? null,
    })
    if (error) throw error
    return data.map((row) => ({
      chunkId: row.chunk_id,
      documentId: row.document_id,
      content: row.content,
      similarity: row.similarity,
    }))
  },
}
