import type { Message } from '@/shared/types/database'
import type { ChatProviderMessage } from '@/modules/ai/providers/ChatProvider'
import { getChatProvider } from '@/modules/ai/providers/registry'
import { insertMessage } from '@/modules/ai/chat/api/messages'
import { touchConversation } from '@/modules/ai/chat/api/conversations'
import { retrieveContext } from '@/modules/ai/orchestration/retrieveContext'
import { buildSystemPrompt } from '@/modules/ai/orchestration/buildSystemPrompt'

export interface SendMessageParams {
  conversationId: string
  userId: string
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
 * (or even knows which one is selected) itself.
 */
export async function sendMessage(params: SendMessageParams): Promise<Message> {
  const { conversationId, userId, providerId, documentId, history, text } = params

  await insertMessage({ conversationId, userId, role: 'user', content: text })

  const matches = await retrieveContext(text, documentId)
  const system = buildSystemPrompt(matches)
  const provider = getChatProvider(providerId)

  let accumulated = ''
  for await (const delta of provider.chat({ messages: [...history, { role: 'user', content: text }], system })) {
    accumulated += delta
    params.onDelta?.(accumulated)
  }

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
