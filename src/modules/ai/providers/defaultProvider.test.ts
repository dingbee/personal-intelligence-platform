import { describe, expect, it } from 'vitest'
import { resolveDefaultChatProviderId } from '@/modules/ai/providers/defaultProvider'

const allAvailable = { anthropic: true, openai: true, google: true }

describe('resolveDefaultChatProviderId', () => {
  it('returns null when there is no preference at all (Auto)', () => {
    expect(resolveDefaultChatProviderId(null, allAvailable)).toBeNull()
    expect(resolveDefaultChatProviderId(undefined, allAvailable)).toBeNull()
  })

  it('returns the preference when it is set and available', () => {
    expect(resolveDefaultChatProviderId('anthropic', allAvailable)).toBe('anthropic')
  })

  it('returns null (not a hardcoded fallback) when the preference is set but no longer available', () => {
    expect(resolveDefaultChatProviderId('anthropic', { anthropic: false, openai: true, google: true })).toBeNull()
  })

  it('returns null when the preference is set but disabled via a per-user override', () => {
    expect(resolveDefaultChatProviderId('anthropic', allAvailable, { anthropic: false })).toBeNull()
  })
})
