import { describe, expect, it } from 'vitest'
import { mergeConversationSearchResults } from '@/modules/ai/chat/api/conversationSearch'
import type { Conversation } from '@/shared/types/database'

function conversation(overrides: Partial<Conversation> & { id: string }): Conversation {
  return {
    user_id: 'u1',
    workspace_id: 'w1',
    document_id: null,
    title: 'Untitled',
    provider_id: 'anthropic',
    archived_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('mergeConversationSearchResults', () => {
  it('deduplicates a conversation matched by both title and message content', () => {
    const c = conversation({ id: '1' })
    const result = mergeConversationSearchResults([c], [c])
    expect(result).toHaveLength(1)
  })

  it('unions distinct conversations from both sources', () => {
    const result = mergeConversationSearchResults([conversation({ id: '1' })], [conversation({ id: '2' })])
    expect(result.map((c) => c.id).sort()).toEqual(['1', '2'])
  })

  it('sorts results most-recently-updated first', () => {
    const older = conversation({ id: '1', updated_at: '2026-01-01T00:00:00.000Z' })
    const newer = conversation({ id: '2', updated_at: '2026-01-05T00:00:00.000Z' })
    const result = mergeConversationSearchResults([older], [newer])
    expect(result.map((c) => c.id)).toEqual(['2', '1'])
  })

  it('returns an empty array when both sources are empty', () => {
    expect(mergeConversationSearchResults([], [])).toEqual([])
  })
})
