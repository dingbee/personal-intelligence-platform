import type { Message } from '@/shared/types/database'
import type { ChatProviderMessage } from '@/modules/ai/providers/ChatProvider'
import { getChatProvider } from '@/modules/ai/providers/registry'
import { insertMessage } from '@/modules/ai/chat/api/messages'
import { touchConversation } from '@/modules/ai/chat/api/conversations'
import { retrieveContext } from '@/modules/ai/orchestration/retrieveContext'
import { buildSystemPrompt } from '@/modules/ai/orchestration/buildSystemPrompt'
import { streamChatCompletion } from '@/modules/ai/orchestration/streamChatCompletion'
import { indexMessage } from '@/modules/search/indexing/indexMessage'

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
 * (or even knows which one is selected) itself.
 */
export async function sendMessage(params: SendMessageParams): Promise<Message> {
  const { conversationId, userId, workspaceId, providerId, documentId, history, text } = params

  const userMessage = await insertMessage({ conversationId, userId, role: 'user', content: text })
  void indexMessage(userMessage, workspaceId)

  const matches = await retrieveContext({ query: text, userId, workspaceId, documentId })
  const system = buildSystemPrompt(matches)

  const { content } = await streamChatCompletion({
    provider: getChatProvider(providerId),
    messages: [...history, { role: 'user', content: text }],
    system,
    userId,
    workspaceId,
    feature: 'chat',
    onDelta: params.onDelta,
  })

  const assistantMessage = await insertMessage({
    conversationId,
    userId,
    role: 'assistant',
    content,
    contextChunkIds: matches.map((match) => match.chunkId),
  })
  void indexMessage(assistantMessage, workspaceId)

  await touchConversation(conversationId)
  return assistantMessage
}
