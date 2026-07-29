import type { Message } from '@/shared/types/database'
import type { ChatProviderMessage } from '@/modules/ai/providers/ChatProvider'
import { getChatProvider } from '@/modules/ai/providers/registry'
import { insertMessage } from '@/modules/ai/chat/api/messages'
import { touchConversation } from '@/modules/ai/chat/api/conversations'
import { retrieveContext } from '@/modules/ai/orchestration/retrieveContext'
import { buildSystemPrompt } from '@/modules/ai/orchestration/buildSystemPrompt'
import { buildContextTrace, type ContextTrace } from '@/modules/ai/orchestration/buildContextTrace'
import { retrieveGraphContext } from '@/modules/knowledge-intelligence/api/retrieveGraphContext'
import { retrieveMemoryContext } from '@/modules/ai/memory/retrieveMemoryContext'
import { streamChatCompletion } from '@/modules/ai/orchestration/streamChatCompletion'
import { runWithFallback } from '@/modules/ai/router/runWithFallback'
import { indexMessage } from '@/modules/search/indexing/indexMessage'
import { resolveNovaContext } from '@/modules/intelligence/context/contextResolver'
import { buildNovaContextPrompt } from '@/modules/intelligence/buildNovaContextPrompt'
import { generateFollowUpSuggestions } from '@/modules/intelligence/conversation/generateFollowUpSuggestions'
import { detectSignals } from '@/modules/intelligence/signals/signalDetector'
import type { IntelligenceSignal } from '@/modules/intelligence/signals/types'

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

export interface SendMessageResult {
  message: Message
  /** UX-6 Phase 5 — context-derived "would you like me to..." suggestions, never a fixed set. */
  suggestions: string[]
  /** Same counts UX-5.2 already logged internally — now returned so the UI can show "Used: ..." (Phase 7). */
  contextTrace: ContextTrace
  /** UX-6 Phase 6 — informational only, nothing here is auto-acted-on. */
  signals: IntelligenceSignal[]
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
export async function sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
  const { conversationId, userId, workspaceId, providerChain, documentId, history, text } = params

  const userMessage = await insertMessage({ conversationId, userId, role: 'user', content: text })
  void indexMessage(userMessage, workspaceId)

  const matches = await retrieveContext({ query: text, userId, workspaceId, documentId })
  // retrieveGraphContext/retrieveMemoryContext never throw (see their own
  // try/catch) — a missing or empty knowledge graph or memory store just
  // means no <knowledge_connections>/<personal_context> block, never a
  // broken chat response.
  const graphContext = await retrieveGraphContext({
    documentIds: [...new Set(matches.map((match) => match.documentId))],
    userId,
    workspaceId,
  })
  const memoryContext = await retrieveMemoryContext({ userId, workspaceId })
  let system = buildSystemPrompt(matches, graphContext, memoryContext)

  const contextTrace = buildContextTrace(matches.length, graphContext, memoryContext)
  // Internal-only, logged not persisted (Phase UX-5.2) — "why did NOVA
  // answer this way" isn't user- or UI-facing yet, that's a later phase.
  console.debug('[AIService] context trace', contextTrace)

  // UX-6: the NOVA Context Engine + personality/situational prompt layer.
  // resolveNovaContext never throws by design (every source is its own
  // try/catch) — matching that same "must never break chat" contract, so
  // this stays additive to the UX-5.2 prompt above, never a replacement.
  const novaContext = await resolveNovaContext({
    userId,
    workspaceId,
    graphContextText: graphContext,
    memoryContextText: memoryContext,
  })
  system = `${system}\n\n${buildNovaContextPrompt(novaContext, text)}`

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

  return {
    message: assistantMessage,
    suggestions: generateFollowUpSuggestions({ matchCount: matches.length, context: novaContext }),
    contextTrace,
    signals: detectSignals({
      context: novaContext,
      matchCount: matches.length,
      documentId: documentId ?? null,
      responseLength: result.content.length,
    }),
  }
}
