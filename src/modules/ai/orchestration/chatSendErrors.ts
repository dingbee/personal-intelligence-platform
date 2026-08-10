import type { Message } from '@/shared/types/database'

/**
 * Thrown by AIService.sendMessage when ARRIYIA's own plan/quota check
 * rejects the send, before any provider call is made — distinct from a
 * transport/provider failure so the UI can tell "you're out of quota"
 * apart from "the AI failed to respond." Never thrown after
 * quotaService.consumeQuota has run, so it never represents an
 * already-billed turn.
 */
export class QuotaDeniedError extends Error {}

/**
 * Wraps any failure that happens after AIService.sendMessage has already
 * persisted the user's message (via insertMessage, or the
 * existingUserMessage passed in on retry), carrying that row through so a
 * caller can retry the same turn without re-inserting it — see
 * useSendMessage's retry path. `cause` is the original error (read by
 * normalizeAiError for categorization); `.message` mirrors it so anything
 * reading this error directly still gets a sensible string.
 */
export class ChatSendFailure extends Error {
  userMessage: Message

  constructor(cause: unknown, userMessage: Message) {
    super(cause instanceof Error ? cause.message : 'The AI request failed.')
    this.cause = cause
    this.userMessage = userMessage
  }
}
