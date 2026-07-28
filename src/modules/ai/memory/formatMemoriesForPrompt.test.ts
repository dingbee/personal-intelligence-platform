import { describe, expect, it } from 'vitest'
import { formatMemoriesForPrompt } from '@/modules/ai/memory/formatMemoriesForPrompt'
import type { AiMemory, AiMemoryType } from '@/shared/types/database'

let counter = 0
function makeMemory(overrides: Partial<AiMemory> = {}): AiMemory {
  counter += 1
  return {
    id: `memory-${counter}`,
    user_id: 'user-1',
    workspace_id: null,
    memory_type: 'explicit_profile',
    content: `Content ${counter}`,
    source: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('formatMemoriesForPrompt', () => {
  it('returns an empty string for no memories', () => {
    expect(formatMemoriesForPrompt([])).toBe('')
  })

  it('renders a single type as a header followed by bullets, most recent first', () => {
    const memories = [
      makeMemory({
        memory_type: 'explicit_profile',
        content: 'Runs a boutique hotel in Bali',
        updated_at: '2026-02-01T00:00:00.000Z',
      }),
      makeMemory({
        memory_type: 'explicit_profile',
        content: 'Prefers metric units',
        updated_at: '2026-01-01T00:00:00.000Z',
      }),
    ]
    expect(formatMemoriesForPrompt(memories)).toBe(
      '## What NOVA knows about you\n- Runs a boutique hotel in Bali\n- Prefers metric units',
    )
  })

  it('orders sections explicit_profile > learned_preference > conversation_memory regardless of input order', () => {
    const memories = [
      makeMemory({ memory_type: 'conversation_memory', content: 'Mentioned writing a book' }),
      makeMemory({ memory_type: 'learned_preference', content: 'Likes concise answers' }),
      makeMemory({ memory_type: 'explicit_profile', content: 'Runs a boutique hotel' }),
    ]
    const result = formatMemoriesForPrompt(memories)
    const profileIndex = result.indexOf('What NOVA knows about you')
    const preferenceIndex = result.indexOf('Learned preferences')
    const conversationIndex = result.indexOf('From past conversations')
    expect(profileIndex).toBeGreaterThanOrEqual(0)
    expect(profileIndex).toBeLessThan(preferenceIndex)
    expect(preferenceIndex).toBeLessThan(conversationIndex)
  })

  it('omits a section entirely when there are no memories of that type', () => {
    const memories = [makeMemory({ memory_type: 'learned_preference', content: 'Likes concise answers' })]
    const result = formatMemoriesForPrompt(memories)
    expect(result).not.toContain('What NOVA knows about you')
    expect(result).not.toContain('From past conversations')
    expect(result).toContain('Learned preferences')
  })

  it('sorts memories within a section by most-recently-updated first', () => {
    const memories = [
      makeMemory({ memory_type: 'explicit_profile', content: 'Older', updated_at: '2026-01-01T00:00:00.000Z' }),
      makeMemory({ memory_type: 'explicit_profile', content: 'Newer', updated_at: '2026-06-01T00:00:00.000Z' }),
    ]
    const result = formatMemoriesForPrompt(memories)
    expect(result.indexOf('Newer')).toBeLessThan(result.indexOf('Older'))
  })

  it('caps each section at maxPerType', () => {
    const memories: AiMemory[] = Array.from({ length: 5 }, (_, i) =>
      makeMemory({ memory_type: 'explicit_profile', content: `Item ${i}`, updated_at: `2026-01-0${i + 1}T00:00:00.000Z` }),
    )
    const result = formatMemoriesForPrompt(memories, { maxPerType: 2 })
    const bulletCount = result.split('\n').filter((line) => line.startsWith('- ')).length
    expect(bulletCount).toBe(2)
  })

  it('caps each type independently', () => {
    const types: AiMemoryType[] = ['explicit_profile', 'learned_preference']
    const memories = types.flatMap((type) =>
      Array.from({ length: 3 }, (_, i) => makeMemory({ memory_type: type, content: `${type}-${i}` })),
    )
    const result = formatMemoriesForPrompt(memories, { maxPerType: 1 })
    const bulletCount = result.split('\n').filter((line) => line.startsWith('- ')).length
    expect(bulletCount).toBe(2)
  })
})
