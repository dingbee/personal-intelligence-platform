import { describe, expect, it } from 'vitest'
import { isMemoryUsedByPrompt } from '@/modules/ai/memory/memoryPromptUsage'
import type { AiMemory } from '@/shared/types/database'

function memory(id: string, updatedAt: string, overrides: Partial<AiMemory> = {}): AiMemory {
  return {
    id,
    user_id: 'u1',
    workspace_id: null,
    memory_type: 'conversation_memory',
    content: id,
    source: null,
    is_active: true,
    created_at: updatedAt,
    updated_at: updatedAt,
    ...overrides,
  }
}

describe('isMemoryUsedByPrompt', () => {
  it('is used when it is the only memory of its type', () => {
    const m = memory('1', '2026-01-01T00:00:00.000Z')
    expect(isMemoryUsedByPrompt(m, [m])).toBe(true)
  })

  it('is used when within the top 10 most-recently-updated of its type', () => {
    const memories = Array.from({ length: 10 }, (_, i) => memory(String(i), `2026-01-${10 - i}T00:00:00.000Z`))
    expect(isMemoryUsedByPrompt(memories[9]!, memories)).toBe(true)
  })

  it('is not used once it falls beyond the per-type cap', () => {
    const memories = Array.from({ length: 11 }, (_, i) => memory(String(i), `2026-01-${20 - i}T00:00:00.000Z`))
    const oldest = memories[10]!
    expect(isMemoryUsedByPrompt(oldest, memories)).toBe(false)
  })

  it('ranks separately per memory type, so one type never crowds out another', () => {
    const profileMemories = Array.from({ length: 10 }, (_, i) =>
      memory(`p${i}`, `2026-01-${10 - i}T00:00:00.000Z`, { memory_type: 'explicit_profile' }),
    )
    const conversationMemory = memory('c1', '2025-01-01T00:00:00.000Z', { memory_type: 'conversation_memory' })
    expect(isMemoryUsedByPrompt(conversationMemory, [...profileMemories, conversationMemory])).toBe(true)
  })

  it('returns false for a memory not present in the given list', () => {
    const m = memory('1', '2026-01-01T00:00:00.000Z')
    const other = memory('2', '2026-01-02T00:00:00.000Z')
    expect(isMemoryUsedByPrompt(m, [other])).toBe(false)
  })
})
