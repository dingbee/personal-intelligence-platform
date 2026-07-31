import { describe, expect, it } from 'vitest'
import { normalizeGeneratedTitle } from '@/modules/intelligence/conversation/conversationTitle/titleNormalizer'

describe('normalizeGeneratedTitle', () => {
  it('title-cases a clean multi-word candidate', () => {
    expect(normalizeGeneratedTitle('hospitality marketing strategy')).toBe('Hospitality Marketing Strategy')
  })

  it('strips surrounding quotes', () => {
    expect(normalizeGeneratedTitle('"Quantum Physics Explanation"')).toBe('Quantum Physics Explanation')
  })

  it('strips punctuation', () => {
    expect(normalizeGeneratedTitle('Direct Booking Growth Strategy!')).toBe('Direct Booking Growth Strategy')
  })

  it('strips emoji', () => {
    expect(normalizeGeneratedTitle('🚀 Direct Booking Growth')).toBe('Direct Booking Growth')
  })

  it('truncates to a maximum of 6 words', () => {
    expect(normalizeGeneratedTitle('one two three four five six seven eight')).toBe('One Two Three Four Five Six')
  })

  it('preserves short all-caps acronyms', () => {
    expect(normalizeGeneratedTitle('AI ethics overview')).toBe('AI Ethics Overview')
  })

  it('rejects a generic title: New Conversation', () => {
    expect(normalizeGeneratedTitle('New Conversation')).toBeNull()
  })

  it('rejects a generic title: Help', () => {
    expect(normalizeGeneratedTitle('Help')).toBeNull()
  })

  it('rejects a generic title: Question', () => {
    expect(normalizeGeneratedTitle('Question')).toBeNull()
  })

  it('rejects titles starting with "Conversation about"', () => {
    expect(normalizeGeneratedTitle('Conversation about marketing')).toBeNull()
  })

  it('rejects an empty or whitespace-only candidate', () => {
    expect(normalizeGeneratedTitle('   ')).toBeNull()
  })

  it('rejects a candidate that is pure punctuation', () => {
    expect(normalizeGeneratedTitle('!!!???')).toBeNull()
  })

  it('is case-insensitive when matching generic titles', () => {
    expect(normalizeGeneratedTitle('new conversation')).toBeNull()
  })
})
