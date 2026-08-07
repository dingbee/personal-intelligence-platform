import { describe, expect, it } from 'vitest'
import { needsConfidenceReview } from '@/modules/assets/intelligence/assetConfidence'

describe('needsConfidenceReview', () => {
  it('returns false when confidence is null (no self-reported estimate at all)', () => {
    expect(needsConfidenceReview(null)).toBe(false)
  })

  it('returns false when every dimension is at or above the threshold', () => {
    expect(needsConfidenceReview({ text: 0.9, entities: 0.7, relationships: 0.5 })).toBe(false)
  })

  it('returns true when any single dimension is below the threshold', () => {
    expect(needsConfidenceReview({ text: 0.9, entities: 0.3, relationships: 0.9 })).toBe(true)
  })

  it('ignores dimensions the model never reported (null), rather than treating them as low confidence', () => {
    expect(needsConfidenceReview({ text: 0.9, entities: null, relationships: 0.9 })).toBe(false)
  })

  it('flags a fully low-confidence result', () => {
    expect(needsConfidenceReview({ text: 0.1, entities: 0.2, relationships: 0.1 })).toBe(true)
  })
})
