import { describe, expect, it } from 'vitest'
import { classifyIntelligenceQuery } from '@/modules/knowledge-intelligence/queries/intelligenceQueryClassifier'

describe('classifyIntelligenceQuery', () => {
  it('classifies "How has my thinking changed about this?" as evolution', () => {
    expect(classifyIntelligenceQuery('How has my thinking changed about this?').type).toBe('evolution')
  })

  it('classifies "What documents relate to this idea?" as related_sources', () => {
    expect(classifyIntelligenceQuery('What documents relate to this idea?').type).toBe('related_sources')
  })

  it('classifies "What knowledge am I missing?" as gaps', () => {
    expect(classifyIntelligenceQuery('What knowledge am I missing?').type).toBe('gaps')
  })

  it('classifies "What patterns do you see?" as patterns', () => {
    expect(classifyIntelligenceQuery('What patterns do you see?').type).toBe('patterns')
  })

  it('classifies "What decisions have I made?" as decisions', () => {
    expect(classifyIntelligenceQuery('What decisions have I made?').type).toBe('decisions')
  })

  it('is case-insensitive', () => {
    expect(classifyIntelligenceQuery('WHAT DECISIONS HAVE I MADE?').type).toBe('decisions')
  })

  it('falls back to related_sources at lower confidence for an unmatched query', () => {
    const result = classifyIntelligenceQuery('asdlkfj random text')
    expect(result.type).toBe('related_sources')
    expect(result.matchedRule).toBe('fallback-related-sources')
  })

  it('returns zero confidence for empty input', () => {
    expect(classifyIntelligenceQuery('   ').confidence).toBe(0)
  })
})
