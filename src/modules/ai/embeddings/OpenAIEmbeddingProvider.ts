import type { EmbeddingLogContext, EmbeddingProvider } from '@/modules/ai/embeddings/EmbeddingProvider'
import { invokeAiEmbed } from '@/modules/ai/providers/edgeFunctionClient'
import { logAiRequest } from '@/modules/ai/observability/api/aiRequests'

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  modelName = 'text-embedding-3-small'
  dimensions = 1536

  async embed(texts: string[], context?: EmbeddingLogContext): Promise<number[][]> {
    const start = performance.now()
    try {
      const result = await invokeAiEmbed(texts)
      if (context) {
        void logAiRequest({
          userId: context.userId,
          workspaceId: context.workspaceId,
          feature: context.feature,
          provider: 'openai',
          model: result.model,
          tokensInput: result.promptTokens,
          latencyMs: Math.round(performance.now() - start),
          status: 'success',
        })
      }
      return result.embeddings
    } catch (err) {
      if (context) {
        void logAiRequest({
          userId: context.userId,
          workspaceId: context.workspaceId,
          feature: context.feature,
          provider: 'openai',
          model: this.modelName,
          latencyMs: Math.round(performance.now() - start),
          status: 'error',
          errorMessage: err instanceof Error ? err.message : 'Unknown error',
        })
      }
      throw err
    }
  }
}
