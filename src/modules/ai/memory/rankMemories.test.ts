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
    reinforcement_count: 0,
    last_reinforced_at: null,
    ...overrides,
  }
}

// Fixed reference instant — every test below pins `now` explicitly so
// decay math is deterministic and never depends on the real wall clock
// (fixtures dated in the past would otherwise decay by however much real
// time has elapsed since this test was written).
const NOW = new Date('2026-06-15T00:00:00.000Z')

describe('rankMemories', () => {
  it('ranks a higher-confidence memory above a lower-confidence one when both are similarly recent', () => {
    // Both updated within the last two weeks of `now` — decay barely
    // separates them, isolating "does confidence still dominate" from the
    // separate, now-real question of how much age difference matters.
    const older = makeMemory({ content: 'high confidence, older', confidence: 0.9, updated_at: '2026-06-01T00:00:00.000Z' })
    const newer = makeMemory({ content: 'low confidence, newer', confidence: 0.3, updated_at: '2026-06-14T00:00:00.000Z' })
    const ranked = rankMemories([newer, older], NOW)
    expect(ranked[0]!.content).toBe('high confidence, older')
  })

  it('falls back to most-recently-updated when confidence is equal', () => {
    const older = makeMemory({ content: 'older', confidence: 0.5, updated_at: '2026-06-01T00:00:00.000Z' })
    const newer = makeMemory({ content: 'newer', confidence: 0.5, updated_at: '2026-06-14T00:00:00.000Z' })
    // Equal stored confidence but different ages actually decays them to
    // different effective values now — pin both close to `now` so the
    // decay gap stays negligible and updated_at is genuinely the
    // deciding factor, matching this test's own name/intent.
    const ranked = rankMemories([older, newer], NOW)
    expect(ranked[0]!.content).toBe('newer')
  })

  it('falls back to most-recently-updated when confidence is null on both (unchanged prior behavior)', () => {
    const older = makeMemory({ content: 'older', confidence: null, updated_at: '2026-01-01T00:00:00.000Z' })
    const newer = makeMemory({ content: 'newer', confidence: null, updated_at: '2026-06-01T00:00:00.000Z' })
    const ranked = rankMemories([older, newer], NOW)
    expect(ranked[0]!.content).toBe('newer')
  })

  it('ranks any scored memory above an unscored (null-confidence) one, however low the score or however decayed', () => {
    const scoredLow = makeMemory({ content: 'scored low', confidence: 0.1, updated_at: '2020-01-01T00:00:00.000Z' })
    const unscored = makeMemory({ content: 'unscored', confidence: null, updated_at: '2026-06-01T00:00:00.000Z' })
    const ranked = rankMemories([unscored, scoredLow], NOW)
    expect(ranked[0]!.content).toBe('scored low')
  })

  it('UX-14.2: a recently reinforced memory outranks a stale equivalent of the same original confidence', () => {
    const stale = makeMemory({
      content: 'stale',
      confidence: 0.7,
      updated_at: '2025-01-01T00:00:00.000Z',
      last_reinforced_at: null,
    })
    const reinforced = makeMemory({
      content: 'recently reinforced',
      confidence: 0.7,
      updated_at: '2025-01-01T00:00:00.000Z',
      reinforcement_count: 3,
      last_reinforced_at: '2026-06-10T00:00:00.000Z',
    })
    const ranked = rankMemories([stale, reinforced], NOW)
    expect(ranked[0]!.content).toBe('recently reinforced')
  })

  it('UX-14.2: decay lets a fresher, lower-original-confidence memory eventually outrank a very stale higher-confidence one', () => {
    const veryStaleHighConfidence = makeMemory({ content: 'very stale', confidence: 0.95, updated_at: '2020-01-01T00:00:00.000Z' })
    const freshModerateConfidence = makeMemory({ content: 'fresh', confidence: 0.5, updated_at: '2026-06-14T00:00:00.000Z' })
    const ranked = rankMemories([veryStaleHighConfidence, freshModerateConfidence], NOW)
    expect(ranked[0]!.content).toBe('fresh')
  })
})
