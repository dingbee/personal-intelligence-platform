import type { Chunk, ChunkInput, Chunker } from '@/modules/processing/chunking/types'

/**
 * Future work: group text by embedding-similarity breakpoints rather than
 * fixed size or paragraph boundaries, for better RAG retrieval quality.
 * Needs a real EmbeddingProvider (Milestone 4) to be meaningful, so this is
 * intentionally unimplemented until then.
 */
export const semanticChunker: Chunker = {
  strategy: 'semantic',
  chunk(_input: ChunkInput): Chunk[] {
    throw new Error('Semantic chunking is not implemented yet — requires a real EmbeddingProvider.')
  },
}
