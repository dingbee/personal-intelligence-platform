import { describe, expect, it } from 'vitest'
import { selectResponseStrategy, describeResponseStrategy } from '@/modules/intelligence/strategy/responseStrategy'
import type { ResponseStrategyType } from '@/modules/intelligence/strategy/strategyTypes'

describe('selectResponseStrategy', () => {
  it('maps plan to planning', () => {
    expect(selectResponseStrategy('plan', 'Help me plan this.')).toBe('planning')
  })

  it('maps decide to decision', () => {
    expect(selectResponseStrategy('decide', 'Should I do this?')).toBe('decision')
  })

  it('maps compare to comparison', () => {
    expect(selectResponseStrategy('compare', 'Compare these two.')).toBe('comparison')
  })

  it('maps learn and teach to tutorial', () => {
    expect(selectResponseStrategy('learn', 'Help me study.')).toBe('tutorial')
    expect(selectResponseStrategy('teach', 'Teach me this.')).toBe('tutorial')
  })

  it('maps search and read to brief', () => {
    expect(selectResponseStrategy('search', 'Find this.')).toBe('brief')
    expect(selectResponseStrategy('read', 'Open chapter 3.')).toBe('brief')
  })

  it('upgrades summarize to executive_summary when the message asks for a whole-workspace overview', () => {
    expect(selectResponseStrategy('summarize', 'Summarize everything in my workspace.')).toBe('executive_summary')
  })

  it('upgrades analyze to executive_summary for an all-documents scope', () => {
    expect(selectResponseStrategy('analyze', 'Analyze all my documents.')).toBe('executive_summary')
  })

  it('does not upgrade summarize to executive_summary for a narrow, document-scoped request', () => {
    expect(selectResponseStrategy('summarize', 'Summarize this chapter.')).toBe('brief')
  })

  it('does not upgrade non-summarize/analyze intents even with executive scope markers', () => {
    expect(selectResponseStrategy('explain', 'Explain everything about this.')).toBe('tutorial')
  })

  it('covers every intent with a defined strategy', () => {
    const intents: Parameters<typeof selectResponseStrategy>[0][] = [
      'plan', 'decide', 'compare', 'organize', 'create', 'summarize', 'analyze', 'review', 'continue', 'teach', 'learn', 'search', 'read', 'explain', 'ask',
    ]
    for (const intent of intents) {
      expect(typeof selectResponseStrategy(intent, 'irrelevant text')).toBe('string')
    }
  })
})

describe('describeResponseStrategy', () => {
  it('gives every strategy a non-empty description', () => {
    const strategies: ResponseStrategyType[] = [
      'brief', 'standard', 'exploratory', 'tutorial', 'decision', 'comparison', 'planning', 'executive_summary',
    ]
    for (const strategy of strategies) {
      expect(describeResponseStrategy(strategy).length).toBeGreaterThan(0)
    }
  })
})
