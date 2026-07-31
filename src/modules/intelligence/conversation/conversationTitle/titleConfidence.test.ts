import { describe, expect, it } from 'vitest'
import { computeTitleConfidence } from '@/modules/intelligence/conversation/conversationTitle/titleConfidence'

describe('computeTitleConfidence', () => {
  it('scores an ideal-length AI title higher than an ideal-length fallback title', () => {
    const ai = computeTitleConfidence({ source: 'ai', wordCount: 4 })
    const fallback = computeTitleConfidence({ source: 'fallback', wordCount: 4 })
    expect(ai).toBeGreaterThan(fallback)
  })

  it('penalizes a too-short title regardless of source', () => {
    const short = computeTitleConfidence({ source: 'ai', wordCount: 1 })
    const ideal = computeTitleConfidence({ source: 'ai', wordCount: 4 })
    expect(short).toBeLessThan(ideal)
  })

  it('penalizes a too-long title', () => {
    const long = computeTitleConfidence({ source: 'ai', wordCount: 7 })
    const ideal = computeTitleConfidence({ source: 'ai', wordCount: 4 })
    expect(long).toBeLessThan(ideal)
  })

  it('never returns a value outside [0, 1]', () => {
    expect(computeTitleConfidence({ source: 'fallback', wordCount: 1 })).toBeGreaterThanOrEqual(0)
    expect(computeTitleConfidence({ source: 'ai', wordCount: 4 })).toBeLessThanOrEqual(1)
  })

  it('treats word counts within 3-6 as equally ideal', () => {
    expect(computeTitleConfidence({ source: 'ai', wordCount: 3 })).toBe(computeTitleConfidence({ source: 'ai', wordCount: 6 }))
  })
})
