import type { Message } from '@/shared/types/database'
import type { ChatProviderMessage } from '@/modules/ai/providers/ChatProvider'
import { getChatProvider } from '@/modules/ai/providers/registry'
import { insertMessage } from '@/modules/ai/chat/api/messages'
import { touchConversation } from '@/modules/ai/chat/api/conversations'
import { retrieveContext } from '@/modules/ai/orchestration/retrieveContext'
import { buildSystemPrompt } from '@/modules/ai/orchestration/buildSystemPrompt'
import { logAiRequest } from '@/modules/ai/observability/api/aiRequests'

export interface SendMessageParams {
  conversationId: string
  userId: string
  workspaceId: string | null
  providerId: string
  documentId?: string
  /** Prior turns in this conversation, oldest first — not including the new user message. */
  history: ChatProviderMessage[]
  text: string
  /** Called with the accumulated assistant text as it streams in. */
  onDelta?: (textSoFar: string) => void
}

/**
 * The single entry point for AI chat. ChatPage calls this, not a provider
 * directly — it resolves retrieval, prompt construction, and the provider
 * through the registries so the UI never talks to Claude/OpenAI/Gemini
 * (or even knows which one is selected) itself. Also the one place that
 * logs the chat completion to ai_requests (retrieval's embedding call logs
 * itself, inside retrieveContext -> OpenAIEmbeddingProvider).
 */
export async function sendMessage(params: SendMessageParams): Promise<Message> {
  const { conversationId, userId, workspaceId, providerId, documentId, history, text } = params

  await insertMessage({ conversationId, userId, role: 'user', content: text })

  const matches = await retrieveContext({ query: text, userId, workspaceId, documentId })
  const system = buildSystemPrompt(matches)
  const provider = getChatProvider(providerId)

  const start = performance.now()
  let accumulated = ''
  let usageModel: string | null = null
  let tokensInput: number | null = null
  let tokensOutput: number | null = null

  try {
    for await (const delta of provider.chat({
      messages: [...history, { role: 'user', content: text }],
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
      feature: 'chat',
      provider: providerId,
      latencyMs: Math.round(performance.now() - start),
      status: 'error',
      errorMessage: err instanceof Error ? err.message : 'Unknown error',
    })
    throw err
  }

  void logAiRequest({
    userId,
    workspaceId,
    feature: 'chat',
    provider: providerId,
    model: usageModel,
    tokensInput,
    tokensOutput,
    latencyMs: Math.round(performance.now() - start),
    status: 'success',
  })

  const assistantMessage = await insertMessage({
    conversationId,
    userId,
    role: 'assistant',
    content: accumulated,
    contextChunkIds: matches.map((match) => match.chunkId),
  })

  await touchConversation(conversationId)
  return assistantMessage
}
