import { describe, expect, it } from 'vitest'
import { rankMemories } from '@/modules/ai/memory/rankMemories'
import type { AiMemory } from '@/shared/types/database'

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
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    confidence: null,
    ...overrides,
  }
}

describe('rankMemories', () => {
  it('ranks a higher-confidence memory above a lower-confidence one, regardless of recency', () => {
    const older = makeMemory({ content: 'high confidence, older', confidence: 0.9, updated_at: '2026-01-01T00:00:00.000Z' })
    const newer = makeMemory({ content: 'low confidence, newer', confidence: 0.3, updated_at: '2026-06-01T00:00:00.000Z' })
    const ranked = rankMemories([newer, older])
    expect(ranked[0]!.content).toBe('high confidence, older')
  })

  it('falls back to most-recently-updated when confidence is equal', () => {
    const older = makeMemory({ content: 'older', confidence: 0.5, updated_at: '2026-01-01T00:00:00.000Z' })
    const newer = makeMemory({ content: 'newer', confidence: 0.5, updated_at: '2026-06-01T00:00:00.000Z' })
    const ranked = rankMemories([older, newer])
    expect(ranked[0]!.content).toBe('newer')
  })

  it('falls back to most-recently-updated when confidence is null on both (unchanged prior behavior)', () => {
    const older = makeMemory({ content: 'older', confidence: null, updated_at: '2026-01-01T00:00:00.000Z' })
    const newer = makeMemory({ content: 'newer', confidence: null, updated_at: '2026-06-01T00:00:00.000Z' })
    const ranked = rankMemories([older, newer])
    expect(ranked[0]!.content).toBe('newer')
  })

  it('ranks any scored memory above an unscored (null-confidence) one', () => {
    const scoredLow = makeMemory({ content: 'scored low', confidence: 0.1, updated_at: '2026-01-01T00:00:00.000Z' })
    const unscored = makeMemory({ content: 'unscored', confidence: null, updated_at: '2026-06-01T00:00:00.000Z' })
    const ranked = rankMemories([unscored, scoredLow])
    expect(ranked[0]!.content).toBe('scored low')
  })
})
