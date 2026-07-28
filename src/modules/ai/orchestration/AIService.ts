import type { Message } from '@/shared/types/database'
import type { ChatProviderMessage } from '@/modules/ai/providers/ChatProvider'
import { getChatProvider } from '@/modules/ai/providers/registry'
import { insertMessage } from '@/modules/ai/chat/api/messages'
import { touchConversation } from '@/modules/ai/chat/api/conversations'
import { retrieveContext } from '@/modules/ai/orchestration/retrieveContext'
import { buildSystemPrompt } from '@/modules/ai/orchestration/buildSystemPrompt'
import { streamChatCompletion } from '@/modules/ai/orchestration/streamChatCompletion'
import { runWithFallback } from '@/modules/ai/router/runWithFallback'
import { indexMessage } from '@/modules/search/indexing/indexMessage'

export interface SendMessageParams {
  conversationId: string
  userId: string
  workspaceId: string | null
  /** Ordered candidates from useProviderChain — [0] is preferred, the rest are single-hop fallback order. */
  providerChain: string[]
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
 * (or even knows which one is selected) itself. `providerChain` is already
 * fully resolved (candidacy-filtered, preference-first, health-ordered) by
 * useProviderChain before this is called — this function just executes it
 * with single-hop fallback via runWithFallback, never re-deciding anything.
 */
export async function sendMessage(params: SendMessageParams): Promise<Message> {
  const { conversationId, userId, workspaceId, providerChain, documentId, history, text } = params

  const userMessage = await insertMessage({ conversationId, userId, role: 'user', content: text })
  void indexMessage(userMessage, workspaceId)

  const matches = await retrieveContext({ query: text, userId, workspaceId, documentId })
  const system = buildSystemPrompt(matches)

  const { result } = await runWithFallback(providerChain, (candidateId) =>
    streamChatCompletion({
      provider: getChatProvider(candidateId),
      messages: [...history, { role: 'user', content: text }],
      system,
      userId,
      workspaceId,
      feature: 'chat',
      requestedProvider: providerChain[0],
      onDelta: params.onDelta,
    }),
  )

  const assistantMessage = await insertMessage({
    conversationId,
    userId,
    role: 'assistant',
    content: result.content,
    contextChunkIds: matches.map((match) => match.chunkId),
  })
  void indexMessage(assistantMessage, workspaceId)

  await touchConversation(conversationId)
  return assistantMessage
}
