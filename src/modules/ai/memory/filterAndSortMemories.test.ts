import { describe, expect, it } from 'vitest'
import { filterAndSortMemories } from '@/modules/ai/memory/filterAndSortMemories'
import type { AiMemory, AiMemoryType } from '@/shared/types/database'

function makeMemory(overrides: Partial<AiMemory> & { id: string }): AiMemory {
  return {
    user_id: 'user-1',
    workspace_id: null,
    memory_type: 'explicit_profile' as AiMemoryType,
    content: 'content',
    source: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    confidence: null,
    ...overrides,
  }
}

describe('filterAndSortMemories', () => {
  const memories: AiMemory[] = [
    makeMemory({ id: 'a', memory_type: 'explicit_profile', created_at: '2026-01-01T00:00:00.000Z' }),
    makeMemory({ id: 'b', memory_type: 'learned_preference', created_at: '2026-01-03T00:00:00.000Z' }),
    makeMemory({ id: 'c', memory_type: 'conversation_memory', created_at: '2026-01-02T00:00:00.000Z' }),
  ]

  it('returns everything, newest first, for "all" + newest', () => {
    const result = filterAndSortMemories(memories, { typeFilter: 'all', sortOrder: 'newest' })
    expect(result.map((m) => m.id)).toEqual(['b', 'c', 'a'])
  })

  it('returns everything, oldest first, for "all" + oldest', () => {
    const result = filterAndSortMemories(memories, { typeFilter: 'all', sortOrder: 'oldest' })
    expect(result.map((m) => m.id)).toEqual(['a', 'c', 'b'])
  })

  it('filters down to a single memory type', () => {
    const result = filterAndSortMemories(memories, { typeFilter: 'learned_preference', sortOrder: 'newest' })
    expect(result.map((m) => m.id)).toEqual(['b'])
  })

  it('returns an empty array when no memory matches the filter', () => {
    const result = filterAndSortMemories([makeMemory({ id: 'd', memory_type: 'explicit_profile' })], {
      typeFilter: 'conversation_memory',
      sortOrder: 'newest',
    })
    expect(result).toEqual([])
  })

  it('does not mutate the input array', () => {
    const copy = [...memories]
    filterAndSortMemories(memories, { typeFilter: 'all', sortOrder: 'oldest' })
    expect(memories).toEqual(copy)
  })
})
