import type { Message } from '@/shared/types/database'
import type { ChatProviderMessage } from '@/modules/ai/providers/ChatProvider'

/**
 * PIP Sprint 9/10 — `listMessages` (and therefore ChatPage/ReaderChatPanel's
 * `messages`) is intentionally unbounded: the UI must show a conversation's
 * complete history. But both call sites also fed that same unbounded array
 * to the model as `history` on every single turn — a long-running
 * conversation (hundreds of messages) sent its entire transcript to the
 * provider every time, growing prompt size, latency, and cost without
 * bound as the conversation got longer. `sendMessage` itself already
 * appends the new user message and never truncates it (see
 * AIService.test.ts's own "does not truncate" test) — the bound belongs
 * here, at construction, not inside the provider call.
 *
 * `MAX_HISTORY_MESSAGES` is a message count, not a token budget: exact
 * enough to give the model several recent exchanges of real context
 * without re-deriving a token count on every turn — the same
 * "explicit, defensible limit" pattern retrieveContext/retrieveGraphContext
 * already use (SEMANTIC_MATCH_COUNT, MAX_NODES, ...), applied to
 * conversation history for the first time.
 */
export const MAX_HISTORY_MESSAGES = 40

/** Maps persisted messages to the provider's wire shape, keeping only the most recent MAX_HISTORY_MESSAGES — oldest-first, matching what sendMessage already expects. */
export function buildChatHistory(messages: Pick<Message, 'role' | 'content'>[]): ChatProviderMessage[] {
  return messages.slice(-MAX_HISTORY_MESSAGES).map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
}
