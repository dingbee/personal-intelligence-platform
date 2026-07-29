import { describe, expect, it } from 'vitest'
import { detectAttentionItems, findContradictoryMemoryPairs } from '@/modules/intelligence/orchestrator/attentionEngine'
import type { AiMemory } from '@/shared/types/database'

function makeMemory(overrides: Partial<AiMemory> & { id: string; content: string }): AiMemory {
  return {
    user_id: 'user-1',
    workspace_id: null,
    memory_type: 'learned_preference',
    source: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

const BASE_INPUT = {
  inProgressDocument: null,
  memories: [] as AiMemory[],
  userQuery: 'Hello',
  recentConversations: [] as { title: string }[],
  workspaceLastActivityAt: null,
  now: new Date('2026-06-01T00:00:00.000Z'),
}

describe('findContradictoryMemoryPairs', () => {
  it('finds a pair with opposite sentiment on the same topic', () => {
    const memories = [
      makeMemory({ id: 'm1', content: 'User prefers dark mode interfaces.' }),
      makeMemory({ id: 'm2', content: 'User dislikes dark mode interfaces.' }),
    ]
    expect(findContradictoryMemoryPairs(memories)).toHaveLength(1)
  })

  it('does not flag two consistent preferences', () => {
    const memories = [
      makeMemory({ id: 'm1', content: 'User prefers dark mode interfaces.' }),
      makeMemory({ id: 'm2', content: 'User prefers concise explanations.' }),
    ]
    expect(findContradictoryMemoryPairs(memories)).toEqual([])
  })

  it('ignores non-preference memory types', () => {
    const memories = [
      makeMemory({ id: 'm1', memory_type: 'explicit_profile', content: 'User prefers dark mode.' }),
      makeMemory({ id: 'm2', memory_type: 'explicit_profile', content: 'User dislikes dark mode.' }),
    ]
    expect(findContradictoryMemoryPairs(memories)).toEqual([])
  })

  it('does not flag opposite sentiment on unrelated topics', () => {
    const memories = [
      makeMemory({ id: 'm1', content: 'User prefers dark mode interfaces.' }),
      makeMemory({ id: 'm2', content: 'User dislikes spicy food.' }),
    ]
    expect(findContradictoryMemoryPairs(memories)).toEqual([])
  })
})

describe('detectAttentionItems', () => {
  it('returns nothing when there is no signal in the input', () => {
    expect(detectAttentionItems(BASE_INPUT)).toEqual([])
  })

  it('flags an unfinished book', () => {
    const items = detectAttentionItems({ ...BASE_INPUT, inProgressDocument: { title: 'Deep Work', scrollFraction: 0.3 } })
    expect(items.some((i) => i.type === 'unfinished_book')).toBe(true)
  })

  it('does not flag unfinished for a completed book', () => {
    const items = detectAttentionItems({ ...BASE_INPUT, inProgressDocument: { title: 'Deep Work', scrollFraction: 0.99 } })
    expect(items.some((i) => i.type === 'unfinished_book')).toBe(false)
  })

  it('flags stopped midway within the band, not near the start or end', () => {
    const midway = detectAttentionItems({ ...BASE_INPUT, inProgressDocument: { title: 'Deep Work', scrollFraction: 0.5 } })
    expect(midway.some((i) => i.type === 'stopped_midway')).toBe(true)

    const justStarted = detectAttentionItems({ ...BASE_INPUT, inProgressDocument: { title: 'Deep Work', scrollFraction: 0.02 } })
    expect(justStarted.some((i) => i.type === 'stopped_midway')).toBe(false)
  })

  it('flags asking about something similar to a recent conversation', () => {
    const items = detectAttentionItems({
      ...BASE_INPUT,
      userQuery: 'Tell me more about hospitality management',
      recentConversations: [{ title: 'Hospitality management basics' }],
    })
    expect(items.some((i) => i.type === 'asked_before')).toBe(true)
  })

  it('flags contradictory memories', () => {
    const items = detectAttentionItems({
      ...BASE_INPUT,
      memories: [
        makeMemory({ id: 'm1', content: 'User prefers dark mode.' }),
        makeMemory({ id: 'm2', content: 'User dislikes dark mode.' }),
      ],
    })
    expect(items.some((i) => i.type === 'contradictory_memories')).toBe(true)
  })

  it('flags an inactive workspace past the threshold', () => {
    const items = detectAttentionItems({ ...BASE_INPUT, workspaceLastActivityAt: '2026-05-01T00:00:00.000Z' })
    expect(items.some((i) => i.type === 'inactive_workspace')).toBe(true)
  })

  it('does not flag a workspace active within the threshold', () => {
    const items = detectAttentionItems({ ...BASE_INPUT, workspaceLastActivityAt: '2026-05-30T00:00:00.000Z' })
    expect(items.some((i) => i.type === 'inactive_workspace')).toBe(false)
  })

  it('assigns high priority to contradictory memories', () => {
    const items = detectAttentionItems({
      ...BASE_INPUT,
      memories: [
        makeMemory({ id: 'm1', content: 'User prefers dark mode.' }),
        makeMemory({ id: 'm2', content: 'User dislikes dark mode.' }),
      ],
    })
    expect(items.find((i) => i.type === 'contradictory_memories')?.priority).toBe('high')
  })

  it('assigns medium priority to an unfinished book and low priority to an inactive workspace', () => {
    const unfinished = detectAttentionItems({ ...BASE_INPUT, inProgressDocument: { title: 'Deep Work', scrollFraction: 0.3 } })
    expect(unfinished.find((i) => i.type === 'unfinished_book')?.priority).toBe('medium')

    const inactive = detectAttentionItems({ ...BASE_INPUT, workspaceLastActivityAt: '2026-05-01T00:00:00.000Z' })
    expect(inactive.find((i) => i.type === 'inactive_workspace')?.priority).toBe('low')
  })
})
