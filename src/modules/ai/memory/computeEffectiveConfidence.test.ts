import { describe, expect, it } from 'vitest'
import { CONFIDENCE_HALF_LIFE_DAYS, computeEffectiveConfidence } from '@/modules/ai/memory/computeEffectiveConfidence'
import type { AiMemory } from '@/shared/types/database'

type MemoryLike = Pick<AiMemory, 'confidence' | 'last_reinforced_at' | 'updated_at'>

const NOW = new Date('2026-06-15T00:00:00.000Z')

describe('computeEffectiveConfidence', () => {
  it('returns null (never a fabricated number) for a memory with no stored confidence', () => {
    const memory: MemoryLike = { confidence: null, last_reinforced_at: null, updated_at: '2026-01-01T00:00:00.000Z' }
    expect(computeEffectiveConfidence(memory, NOW)).toBeNull()
  })

  it('returns the stored confidence unchanged at zero elapsed time', () => {
    const memory: MemoryLike = { confidence: 0.8, last_reinforced_at: null, updated_at: NOW.toISOString() }
    expect(computeEffectiveConfidence(memory, NOW)).toBeCloseTo(0.8, 10)
  })

  it('halves the effective confidence at exactly one half-life', () => {
    const referenceTime = new Date(NOW.getTime() - CONFIDENCE_HALF_LIFE_DAYS * 24 * 60 * 60 * 1000).toISOString()
    const memory: MemoryLike = { confidence: 0.8, last_reinforced_at: null, updated_at: referenceTime }
    expect(computeEffectiveConfidence(memory, NOW)).toBeCloseTo(0.4, 5)
  })

  it('decay lowers effective confidence over time without ever mutating the stored value — the caller can still see the original 0.8 right next to the decayed read', () => {
    const memory: MemoryLike = { confidence: 0.8, last_reinforced_at: null, updated_at: '2025-01-01T00:00:00.000Z' }
    const effective = computeEffectiveConfidence(memory, NOW)
    expect(effective).not.toBeNull()
    expect(effective!).toBeLessThan(0.8)
    expect(effective!).toBeGreaterThan(0)
    // The one thing decay must never do: touch the stored field itself.
    expect(memory.confidence).toBe(0.8)
  })

  it('prefers last_reinforced_at over updated_at as the decay reference when both are present', () => {
    const recentlyReinforced: MemoryLike = { confidence: 0.8, last_reinforced_at: NOW.toISOString(), updated_at: '2020-01-01T00:00:00.000Z' }
    // If updated_at (2020) were used instead, this would decay to ~0.
    expect(computeEffectiveConfidence(recentlyReinforced, NOW)).toBeCloseTo(0.8, 10)
  })

  it('falls back to updated_at when a memory has never been reinforced', () => {
    const neverReinforced: MemoryLike = { confidence: 0.8, last_reinforced_at: null, updated_at: NOW.toISOString() }
    expect(computeEffectiveConfidence(neverReinforced, NOW)).toBeCloseTo(0.8, 10)
  })

  it('clamps a reference timestamp in the future to zero age rather than inflating confidence', () => {
    const future = new Date(NOW.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString()
    const memory: MemoryLike = { confidence: 0.6, last_reinforced_at: future, updated_at: '2026-01-01T00:00:00.000Z' }
    expect(computeEffectiveConfidence(memory, NOW)).toBeCloseTo(0.6, 10)
  })

  it('approaches but never reaches zero for an extremely stale memory', () => {
    const memory: MemoryLike = { confidence: 0.9, last_reinforced_at: null, updated_at: '1990-01-01T00:00:00.000Z' }
    const effective = computeEffectiveConfidence(memory, NOW)
    expect(effective!).toBeGreaterThan(0)
    expect(effective!).toBeLessThan(0.001)
  })
})
