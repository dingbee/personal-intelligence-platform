import { describe, expect, it } from 'vitest'
import {
  isChatProviderId,
  isChatMessage,
  isValidAiChatRequestBody,
  resolveQuotaKey,
  isModelAllowed,
  OPERATION_FEATURE_BY_QUOTA_KEY,
} from '@/modules/ai/orchestration/aiChatAuthorization'

describe('isChatProviderId', () => {
  it('accepts the three known providers', () => {
    expect(isChatProviderId('anthropic')).toBe(true)
    expect(isChatProviderId('openai')).toBe(true)
    expect(isChatProviderId('google')).toBe(true)
  })

  it('rejects an unknown or internal provider a client might try to inject', () => {
    expect(isChatProviderId('internal-admin-provider')).toBe(false)
    expect(isChatProviderId('')).toBe(false)
    expect(isChatProviderId(undefined)).toBe(false)
    expect(isChatProviderId(123)).toBe(false)
  })
})

describe('isChatMessage', () => {
  it('accepts a plain-string user/assistant message', () => {
    expect(isChatMessage({ role: 'user', content: 'hello' })).toBe(true)
    expect(isChatMessage({ role: 'assistant', content: 'hi' })).toBe(true)
  })

  it('accepts a non-empty multimodal content array', () => {
    expect(isChatMessage({ role: 'user', content: [{ type: 'text', text: 'hi' }] })).toBe(true)
  })

  it('rejects an invalid role, missing content, or empty content array', () => {
    expect(isChatMessage({ role: 'system', content: 'hi' })).toBe(false)
    expect(isChatMessage({ role: 'user' })).toBe(false)
    expect(isChatMessage({ role: 'user', content: [] })).toBe(false)
    expect(isChatMessage(null)).toBe(false)
    expect(isChatMessage('not an object')).toBe(false)
  })
})

describe('isValidAiChatRequestBody', () => {
  it('accepts a well-formed chat request', () => {
    expect(isValidAiChatRequestBody({ action: 'chat', provider: 'openai', messages: [{ role: 'user', content: 'hi' }] })).toBe(true)
  })

  it('accepts a well-formed embed request', () => {
    expect(isValidAiChatRequestBody({ action: 'embed', input: ['hello world'] })).toBe(true)
  })

  it('rejects a chat request with no messages', () => {
    expect(isValidAiChatRequestBody({ action: 'chat', provider: 'openai', messages: [] })).toBe(false)
  })

  it('rejects a chat request with a malformed message in the array', () => {
    expect(isValidAiChatRequestBody({ action: 'chat', provider: 'openai', messages: [{ role: 'user' }] })).toBe(false)
  })

  it('rejects an embed request with an empty or non-string input array', () => {
    expect(isValidAiChatRequestBody({ action: 'embed', input: [] })).toBe(false)
    expect(isValidAiChatRequestBody({ action: 'embed', input: [123] })).toBe(false)
  })

  it('rejects an unknown action', () => {
    expect(isValidAiChatRequestBody({ action: 'delete-everything', provider: 'openai', messages: [] })).toBe(false)
  })

  it('rejects a non-object or null body', () => {
    expect(isValidAiChatRequestBody(null)).toBe(false)
    expect(isValidAiChatRequestBody('malformed')).toBe(false)
    expect(isValidAiChatRequestBody(undefined)).toBe(false)
  })
})

describe('resolveQuotaKey', () => {
  it('resolves an absent quotaKey to ai_messages with no feature check required', () => {
    expect(resolveQuotaKey(undefined)).toEqual({ ok: true, quotaKey: 'ai_messages', featureKey: null })
    expect(resolveQuotaKey(null)).toEqual({ ok: true, quotaKey: 'ai_messages', featureKey: null })
  })

  it('resolves an explicit ai_messages the same way', () => {
    expect(resolveQuotaKey('ai_messages')).toEqual({ ok: true, quotaKey: 'ai_messages', featureKey: null })
  })

  it('resolves every known *_operations key to its corresponding feature key', () => {
    for (const [quotaKey, featureKey] of Object.entries(OPERATION_FEATURE_BY_QUOTA_KEY)) {
      expect(resolveQuotaKey(quotaKey)).toEqual({ ok: true, quotaKey, featureKey })
    }
  })

  it('rejects an unrecognized quota key outright, rather than silently downgrading it to ai_messages', () => {
    expect(resolveQuotaKey('unlimited_operations')).toEqual({ ok: false, reason: 'invalid_quota_key' })
    expect(resolveQuotaKey('ai_messages; drop table quota_usage;')).toEqual({ ok: false, reason: 'invalid_quota_key' })
  })
})

describe('isModelAllowed', () => {
  it('allows an omitted model (falls back to the provider default)', () => {
    expect(isModelAllowed(undefined, 'claude-sonnet-5')).toBe(true)
    expect(isModelAllowed(null, 'claude-sonnet-5')).toBe(true)
    expect(isModelAllowed('', 'claude-sonnet-5')).toBe(true)
  })

  it('allows a model that matches the provider default exactly', () => {
    expect(isModelAllowed('claude-sonnet-5', 'claude-sonnet-5')).toBe(true)
  })

  it('rejects any other model string a client might try to request', () => {
    expect(isModelAllowed('claude-opus-5', 'claude-sonnet-5')).toBe(false)
    expect(isModelAllowed('some-unreleased-internal-model', 'claude-sonnet-5')).toBe(false)
  })
})
