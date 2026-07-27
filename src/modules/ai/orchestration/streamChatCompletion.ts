import type { ChatProvider, ChatProviderMessage } from '@/modules/ai/providers/ChatProvider'
import { logAiRequest } from '@/modules/ai/observability/api/aiRequests'

export interface StreamChatCompletionParams {
  provider: ChatProvider
  messages: ChatProviderMessage[]
  system: string
  userId: string
  workspaceId: string | null
  /** ai_requests.feature — 'chat' for conversations, or a capability id ('summarize', 'flashcards') for one-shot execution. */
  feature: string
  onDelta?: (textSoFar: string) => void
}

export interface StreamChatCompletionResult {
  content: string
  model: string | null
}

/**
 * Consumes a ChatProvider's stream and logs the result to ai_requests —
 * shared by AIService.sendMessage (multi-turn RAG chat) and runCapability
 * (one-shot capability execution) so the usage-tracking/logging boilerplate
 * exists in exactly one place.
 */
export async function streamChatCompletion(
  params: StreamChatCompletionParams,
): Promise<StreamChatCompletionResult> {
  const { provider, messages, system, userId, workspaceId, feature } = params
  const start = performance.now()
  let accumulated = ''
  let usageModel: string | null = null
  let tokensInput: number | null = null
  let tokensOutput: number | null = null

  try {
    for await (const delta of provider.chat({
      messages,
      system,
      onUsage: (usage) => {
        usageModel = usage.model
        tokensInput = usage.inputTokens
        tokensOutput = usage.outputTokens
      },
    })) {
      accumulated += delta
      params.onDelta?.(accumulated)
    }
  } catch (err) {
    void logAiRequest({
      userId,
      workspaceId,
      feature,
      provider: provider.id,
      latencyMs: Math.round(performance.now() - start),
      status: 'error',
      errorMessage: err instanceof Error ? err.message : 'Unknown error',
    })
    throw err
  }

  void logAiRequest({
    userId,
    workspaceId,
    feature,
    provider: provider.id,
    model: usageModel,
    tokensInput,
    tokensOutput,
    latencyMs: Math.round(performance.now() - start),
    status: 'success',
  })

  return { content: accumulated, model: usageModel }
}
