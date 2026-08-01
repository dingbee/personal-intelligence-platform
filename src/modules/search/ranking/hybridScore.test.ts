import { describe, expect, it } from 'vitest'
import { LEXICAL_MATCH_BOOST, applyLexicalBoost } from '@/modules/search/ranking/hybridScore'

describe('applyLexicalBoost', () => {
  it('returns the semantic similarity unchanged when there is no lexical match', () => {
    expect(applyLexicalBoost(0.62, false)).toBe(0.62)
  })

  it('boosts the score when the item also matched lexically', () => {
    expect(applyLexicalBoost(0.62, true)).toBeCloseTo(0.62 + LEXICAL_MATCH_BOOST)
  })

  it('clamps the boosted score at 1', () => {
    expect(applyLexicalBoost(0.98, true)).toBeLessThanOrEqual(1)
  })

  it('never lets a lexical boost alone outrank a strong semantic-only match', () => {
    const strongSemanticOnly = applyLexicalBoost(0.9, false)
    const weakSemanticWithLexicalBoost = applyLexicalBoost(0.5, true)
    expect(strongSemanticOnly).toBeGreaterThan(weakSemanticWithLexicalBoost)
  })
})
