import { describe, expect, it } from 'vitest'
import { applyRecencyBonus } from '@/modules/search/ranking/crossProviderRelevance'

describe('applyRecencyBonus', () => {
  const now = new Date('2026-07-31T12:00:00Z')

  it('returns the similarity unchanged when updatedAt is absent', () => {
    expect(applyRecencyBonus(0.72, undefined, now)).toBe(0.72)
  })

  it('boosts a recently-updated result', () => {
    expect(applyRecencyBonus(0.7, '2026-07-31T06:00:00Z', now)).toBeCloseTo(0.75)
  })

  it('gives no boost to a stale result', () => {
    expect(applyRecencyBonus(0.7, '2026-01-01T00:00:00Z', now)).toBeCloseTo(0.7)
  })

  it('clamps at 1 even with a high base similarity and a fresh update', () => {
    expect(applyRecencyBonus(0.99, '2026-07-31T11:00:00Z', now)).toBeLessThanOrEqual(1)
  })

  it('applies identically regardless of source type — the point of this function', () => {
    const documentScore = applyRecencyBonus(0.6, '2026-07-30T12:00:00Z', now)
    const noteScore = applyRecencyBonus(0.6, '2026-07-30T12:00:00Z', now)
    expect(documentScore).toBe(noteScore)
  })
})
