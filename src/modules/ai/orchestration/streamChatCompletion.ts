import type { ChatProvider, ChatProviderMessage } from '@/modules/ai/providers/ChatProvider'
import { logAiRequest } from '@/modules/ai/observability/api/aiRequests'
import { INTELLIGENCE_OPERATION_QUOTA_KEYS, type IntelligenceOperationType } from '@/shared/lib/intelligenceOperations'

export interface StreamChatCompletionParams {
  provider: ChatProvider
  messages: ChatProviderMessage[]
  system: string
  userId: string
  workspaceId: string | null
  /** ai_requests.feature — 'chat' for conversations, or a capability id ('summarize', 'flashcards') for one-shot execution. */
  feature: string
  /** Phase 8C: the router's chain[0] for this call — pass it any time a caller resolved a provider chain, even when `provider` matches it (see logAiRequest). */
  requestedProvider?: string
  /** Operation Budget Foundation — groups this request with every other AI call belonging to the same intelligence operation (see intelligenceOperations.ts). Omit for calls with no operation context (ordinary chat, one-shot capabilities outside Data/Analysis/Research). */
  operationId?: string | null
  operationType?: string | null
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
  const { provider, messages, system, userId, workspaceId, feature, requestedProvider, operationId, operationType } = params
  const start = performance.now()
  let accumulated = ''
  let usageModel: string | null = null
  let tokensInput: number | null = null
  let tokensOutput: number | null = null

  // Only the row where a fallback actually happened gets a reason — the
  // common case (requestedProvider matches, or wasn't supplied at all)
  // leaves this null, exactly like every request logged before this phase.
  const fallbackReason =
    requestedProvider && requestedProvider !== provider.id
      ? `Routed to ${provider.id} after ${requestedProvider} failed`
      : null

  // P0-1 (Production Technical Blocker Audit) — which quota_key the
  // `ai-chat` edge function should atomically reserve/consume for this
  // specific call, before it ever reaches a real provider. Mirrors
  // intelligenceOperations.ts's own operationType -> quota key mapping
  // exactly (imported, not duplicated) so a Data/Analysis/Research/
  // Planning/Decision/Action Intelligence call is charged against its own
  // operation budget server-side, the same key recordOperationAiCall used
  // to consume client-side before this change. Anything without a
  // recognized operationType (ordinary chat, one-shot capabilities like
  // summarize/flashcards, provider connectivity tests) falls through to
  // 'ai_messages', the universal baseline every plan has.
  const quotaKey = operationType && operationType in INTELLIGENCE_OPERATION_QUOTA_KEYS
    ? INTELLIGENCE_OPERATION_QUOTA_KEYS[operationType as IntelligenceOperationType]
    : undefined

  try {
    for await (const delta of provider.chat({
      messages,
      system,
      quotaKey,
      workspaceId,
      feature,
      requestedProvider,
      fallbackReason,
      operationId,
      operationType,
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
      requestedProvider,
      fallbackReason,
      operationId,
      operationType,
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
    requestedProvider,
    fallbackReason,
    operationId,
    operationType,
  })

  return { content: accumulated, model: usageModel }
}
