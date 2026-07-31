import { describe, expect, it } from 'vitest'
import { groupConversationsByRecency } from '@/modules/ai/chat/groupConversationsByRecency'
import type { Conversation } from '@/shared/types/database'

const NOW = new Date('2026-07-29T15:00:00.000Z')

function conversation(id: string, updatedAt: string): Conversation {
  return {
    id,
    user_id: 'u1',
    workspace_id: 'w1',
    document_id: null,
    title: `Conversation ${id}`,
    provider_id: 'anthropic',
    archived_at: null,
    created_at: updatedAt,
    updated_at: updatedAt,
  }
}

describe('groupConversationsByRecency', () => {
  it('buckets a conversation updated today into Today', () => {
    const groups = groupConversationsByRecency([conversation('1', '2026-07-29T10:00:00.000Z')], NOW)
    expect(groups).toEqual([{ label: 'Today', conversations: [expect.objectContaining({ id: '1' })] }])
  })

  it('buckets a conversation updated yesterday into Yesterday', () => {
    const groups = groupConversationsByRecency([conversation('1', '2026-07-28T10:00:00.000Z')], NOW)
    expect(groups[0]!.label).toBe('Yesterday')
  })

  it('buckets a conversation from 5 days ago into This Week', () => {
    const groups = groupConversationsByRecency([conversation('1', '2026-07-24T10:00:00.000Z')], NOW)
    expect(groups[0]!.label).toBe('This Week')
  })

  it('buckets a conversation from 20 days ago into Last Month', () => {
    const groups = groupConversationsByRecency([conversation('1', '2026-07-09T10:00:00.000Z')], NOW)
    expect(groups[0]!.label).toBe('Last Month')
  })

  it('buckets a conversation from 60 days ago into Older', () => {
    const groups = groupConversationsByRecency([conversation('1', '2026-05-30T10:00:00.000Z')], NOW)
    expect(groups[0]!.label).toBe('Older')
  })

  it('omits empty groups entirely', () => {
    const groups = groupConversationsByRecency([conversation('1', '2026-07-29T10:00:00.000Z')], NOW)
    expect(groups.map((g) => g.label)).toEqual(['Today'])
  })

  it('preserves the input order of conversations within a group', () => {
    const groups = groupConversationsByRecency(
      [conversation('1', '2026-07-29T10:00:00.000Z'), conversation('2', '2026-07-29T09:00:00.000Z')],
      NOW,
    )
    expect(groups[0]!.conversations.map((c) => c.id)).toEqual(['1', '2'])
  })

  it('groups multiple conversations into the same bucket', () => {
    const groups = groupConversationsByRecency(
      [conversation('1', '2026-07-29T10:00:00.000Z'), conversation('2', '2026-07-29T08:00:00.000Z')],
      NOW,
    )
    expect(groups).toHaveLength(1)
    expect(groups[0]!.conversations).toHaveLength(2)
  })

  it('returns an empty array for an empty input', () => {
    expect(groupConversationsByRecency([], NOW)).toEqual([])
  })

  it('orders groups Today, Yesterday, This Week, Last Month, Older', () => {
    const groups = groupConversationsByRecency(
      [
        conversation('older', '2026-05-01T10:00:00.000Z'),
        conversation('today', '2026-07-29T10:00:00.000Z'),
        conversation('week', '2026-07-24T10:00:00.000Z'),
        conversation('yesterday', '2026-07-28T10:00:00.000Z'),
        conversation('month', '2026-07-09T10:00:00.000Z'),
      ],
      NOW,
    )
    expect(groups.map((g) => g.label)).toEqual(['Today', 'Yesterday', 'This Week', 'Last Month', 'Older'])
  })
})
