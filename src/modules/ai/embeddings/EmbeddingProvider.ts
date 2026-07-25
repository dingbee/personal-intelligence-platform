export interface EmbeddingProvider {
  /** Identifies the model for storage/debugging — real providers return their model name. */
  modelName: string
  dimensions: number
  embed(texts: string[]): Promise<number[][]>
}

/**
 * Deterministic, content-derived fake embeddings — NOT semantically
 * meaningful. This exists purely so the processing pipeline and pgvector
 * storage/query path can be built and exercised end to end before a real
 * AI provider is wired up in Milestone 4. Similarity search against these
 * vectors will not return relevant results.
 */
export class PlaceholderEmbeddingProvider implements EmbeddingProvider {
  modelName = 'placeholder-hash-v1'
  dimensions = 1536

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => this.hashToVector(text))
  }

  private hashToVector(text: string): number[] {
    const vector = new Array<number>(this.dimensions).fill(0)
    let seed = 0
    for (let i = 0; i < text.length; i += 1) {
      seed = (seed * 31 + text.charCodeAt(i)) >>> 0
    }
    for (let i = 0; i < this.dimensions; i += 1) {
      seed = (seed * 1103515245 + 12345) >>> 0
      vector[i] = (seed / 0xffffffff) * 2 - 1
    }
    return vector
  }
}
