import { describe, expect, it } from 'vitest'
import { finalizeGeneratedTitle, generateFallbackTitle } from '@/modules/intelligence/conversation/conversationTitle/titleGenerator'

describe('generateFallbackTitle', () => {
  it('extracts significant words, dropping stopwords and request-framing verbs', () => {
    expect(generateFallbackTitle('Help me design a marketing strategy for my hospitality business')).toBe(
      'Marketing Strategy Hospitality Business',
    )
  })

  it('preserves possessive apostrophes', () => {
    expect(generateFallbackTitle("Plan my daughter's birthday")).toBe("Daughter's Birthday")
  })

  it('caps the fallback at 6 significant words', () => {
    const message = 'alpha beta gamma delta epsilon zeta eta theta'
    expect(generateFallbackTitle(message).split(' ')).toHaveLength(6)
  })

  it('falls back to a safe generic-but-not-blocklisted title when no significant words remain', () => {
    expect(generateFallbackTitle('help me understand this')).toBe('General Discussion')
  })

  it('handles an empty message without throwing', () => {
    expect(generateFallbackTitle('')).toBe('General Discussion')
  })
})

describe('finalizeGeneratedTitle', () => {
  it('uses the AI candidate when it normalizes successfully', () => {
    const result = finalizeGeneratedTitle('Hospitality Marketing Strategy', 'Help me design a marketing strategy')
    expect(result).toEqual({ title: 'Hospitality Marketing Strategy', confidence: expect.any(Number), generated: true })
    expect(result.confidence).toBeGreaterThan(0.5)
  })

  it('falls back to the deterministic generator when the AI candidate is null', () => {
    const result = finalizeGeneratedTitle(null, 'Help me design a marketing strategy for my hospitality business')
    expect(result.title).toBe('Marketing Strategy Hospitality Business')
  })

  it('falls back to the deterministic generator when the AI candidate is a rejected generic title', () => {
    const result = finalizeGeneratedTitle('New Conversation', 'Explain quantum physics')
    expect(result.title).toBe('Quantum Physics')
  })

  it('always returns generated: true', () => {
    expect(finalizeGeneratedTitle(null, 'hello').generated).toBe(true)
  })

  it('never returns an empty title', () => {
    const result = finalizeGeneratedTitle(null, '')
    expect(result.title.length).toBeGreaterThan(0)
  })
})
