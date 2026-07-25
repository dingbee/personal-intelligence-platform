import type { EmbeddingProvider } from '@/modules/ai/embeddings/EmbeddingProvider'
import { invokeAiEmbed } from '@/modules/ai/providers/edgeFunctionClient'

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  modelName = 'text-embedding-3-small'
  dimensions = 1536

  async embed(texts: string[]): Promise<number[][]> {
    return invokeAiEmbed(texts)
  }
}
