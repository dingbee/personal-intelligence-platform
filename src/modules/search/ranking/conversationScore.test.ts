import { describe, expect, it } from 'vitest'
import { computeConversationScore, computeRecencyBonus, computeSupportBonus, scoreToStars } from '@/modules/search/ranking/conversationScore'

describe('computeSupportBonus', () => {
  it('is zero for a single match', () => {
    expect(computeSupportBonus(1)).toBe(0)
  })

  it('grows with additional matches', () => {
    expect(computeSupportBonus(2)).toBeCloseTo(0.03)
    expect(computeSupportBonus(3)).toBeCloseTo(0.06)
  })

  it('caps at 0.15 regardless of match count', () => {
    expect(computeSupportBonus(100)).toBe(0.15)
  })
})

describe('computeRecencyBonus', () => {
  const now = new Date('2026-07-31T12:00:00Z')

  it('gives the largest bonus to same-day activity', () => {
    expect(computeRecencyBonus('2026-07-31T06:00:00Z', now)).toBe(0.05)
  })

  it('gives a smaller bonus within the last week', () => {
    expect(computeRecencyBonus('2026-07-26T12:00:00Z', now)).toBe(0.03)
  })

  it('gives a small bonus within the last month', () => {
    expect(computeRecencyBonus('2026-07-05T12:00:00Z', now)).toBe(0.01)
  })

  it('gives no bonus beyond a month', () => {
    expect(computeRecencyBonus('2026-01-01T12:00:00Z', now)).toBe(0)
  })
})

describe('computeConversationScore', () => {
  const now = new Date('2026-07-31T12:00:00Z')

  it('equals raw similarity when there is one stale match', () => {
    const score = computeConversationScore({ topSimilarity: 0.7, matchCount: 1, updatedAt: '2026-01-01T00:00:00Z', now })
    expect(score).toBeCloseTo(0.7)
  })

  it('rewards more supporting matches over fewer, at the same similarity', () => {
    const fewer = computeConversationScore({ topSimilarity: 0.8, matchCount: 1, updatedAt: '2026-01-01T00:00:00Z', now })
    const more = computeConversationScore({ topSimilarity: 0.8, matchCount: 5, updatedAt: '2026-01-01T00:00:00Z', now })
    expect(more).toBeGreaterThan(fewer)
  })

  it('never exceeds 1', () => {
    const score = computeConversationScore({ topSimilarity: 0.99, matchCount: 50, updatedAt: '2026-07-31T11:00:00Z', now })
    expect(score).toBeLessThanOrEqual(1)
  })
})

describe('scoreToStars', () => {
  it('rounds to the nearest star', () => {
    expect(scoreToStars(1)).toBe(5)
    expect(scoreToStars(0.9)).toBe(5)
    expect(scoreToStars(0.6)).toBe(3)
    expect(scoreToStars(0.2)).toBe(1)
  })

  it('never returns fewer than 1 or more than 5', () => {
    expect(scoreToStars(0)).toBe(1)
    expect(scoreToStars(-1)).toBe(1)
    expect(scoreToStars(2)).toBe(5)
  })
})
