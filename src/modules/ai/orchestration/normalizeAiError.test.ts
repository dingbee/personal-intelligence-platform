import { describe, expect, it } from 'vitest'
import { normalizeAiError } from '@/modules/ai/orchestration/normalizeAiError'
import { ChatSendFailure, QuotaDeniedError } from '@/modules/ai/orchestration/chatSendErrors'
import type { Message } from '@/shared/types/database'

function fakeUserMessage(): Message {
  return {
    id: 'msg-1',
    conversation_id: 'conv-1',
    user_id: 'user-1',
    role: 'user',
    content: 'hi',
    context_chunk_ids: [],
    created_at: new Date().toISOString(),
  } as Message
}

describe('normalizeAiError', () => {
  it('categorizes a plain provider-unavailable error as before (regression)', () => {
    const err = new Error('AI request failed (500): {"error":"ANTHROPIC_API_KEY is not configured"}')
    expect(normalizeAiError(err).category).toBe('provider_unavailable')
  })

  it('categorizes a rate-limit-shaped upstream error as rate_limited (regression)', () => {
    const err = new Error('upstream 502: rate limit exceeded')
    expect(normalizeAiError(err).category).toBe('rate_limited')
  })

  it('categorizes an unrecognized error as unknown (regression)', () => {
    const err = new Error('something exploded')
    expect(normalizeAiError(err).category).toBe('unknown')
  })

  // ARRIYIA Product Completion Phase 1 — chat-send UX: quota denial must
  // read as a distinct category from any transport/provider failure, even
  // though its reason text can legitimately contain the word "quota" (the
  // same word that would otherwise trip the rate_limited regex below).
  it('categorizes a QuotaDeniedError as quota_exceeded regardless of its message text', () => {
    const err = new QuotaDeniedError('AI quota limit reached')
    const normalized = normalizeAiError(err)
    expect(normalized.category).toBe('quota_exceeded')
    expect(normalized.isProviderUnavailable).toBe(false)
  })

  it('preserves QuotaDeniedError\'s own reason text verbatim — quotaService already crafts it to be safe and specific', () => {
    const err = new QuotaDeniedError('No active plan or quota configured for your account.')
    expect(normalizeAiError(err).message).toBe('No active plan or quota configured for your account.')
  })

  it('unwraps a ChatSendFailure to categorize its underlying cause, not the wrapper', () => {
    const cause = new QuotaDeniedError('AI quota limit reached')
    const wrapped = new ChatSendFailure(cause, fakeUserMessage())
    const normalized = normalizeAiError(wrapped)
    expect(normalized.category).toBe('quota_exceeded')
    expect(normalized.message).toBe('AI quota limit reached')
  })

  it('unwraps a ChatSendFailure wrapping a transport failure to the matching non-quota category', () => {
    const cause = new Error('The AI took too long to respond.')
    const wrapped = new ChatSendFailure(cause, fakeUserMessage())
    expect(normalizeAiError(wrapped).category).not.toBe('quota_exceeded')
  })

  it('does not misclassify a genuine provider-side quota message as ARRIYIA\'s own quota_exceeded — only an actual QuotaDeniedError does', () => {
    // Not wrapped in QuotaDeniedError — e.g. OpenAI's own account-quota error forwarded as plain text.
    const err = new Error('You exceeded your current quota, please check your plan and billing details.')
    expect(normalizeAiError(err).category).toBe('rate_limited')
  })
})
