import { describe, expect, it } from 'vitest'
import { classifyIntent } from '@/modules/intelligence/intent/intentClassifier'

describe('classifyIntent', () => {
  it('classifies the brief\'s own worked example as learn', () => {
    expect(classifyIntent('Help me prepare for my MBA exam.').intent).toBe('learn')
  })

  it('classifies a planning request as plan', () => {
    expect(classifyIntent('Help me plan my research project.').intent).toBe('plan')
  })

  it('classifies a yes/no decision request as decide', () => {
    expect(classifyIntent('Should I switch providers?').intent).toBe('decide')
  })

  it('classifies a comparison request as compare', () => {
    expect(classifyIntent('Compare Deep Work and Atomic Habits.').intent).toBe('compare')
    expect(classifyIntent('Deep Work vs Atomic Habits').intent).toBe('compare')
  })

  it('classifies an organization request as organize', () => {
    expect(classifyIntent('Can you help me organize my documents?').intent).toBe('organize')
  })

  it('classifies a content-generation request as create', () => {
    expect(classifyIntent('Write me a summary email for my team.').intent).toBe('create')
  })

  it('classifies a summarization request as summarize', () => {
    expect(classifyIntent('Summarize this chapter for me.').intent).toBe('summarize')
  })

  it('classifies an analysis request as analyze', () => {
    expect(classifyIntent('Analyze the trends in my reading notes.').intent).toBe('analyze')
  })

  it('classifies a review request as review', () => {
    expect(classifyIntent('I want to review my highlights from last week.').intent).toBe('review')
  })

  it('classifies a resumption request as continue', () => {
    expect(classifyIntent('Where was I in Deep Work?').intent).toBe('continue')
  })

  it('classifies a teaching request as teach', () => {
    expect(classifyIntent('Teach me how spaced repetition works.').intent).toBe('teach')
  })

  it('classifies a search request as search', () => {
    expect(classifyIntent('Find the document about pricing strategy.').intent).toBe('search')
  })

  it('classifies a reading-navigation request as read', () => {
    expect(classifyIntent('Open chapter 5 of Deep Work.').intent).toBe('read')
  })

  it('classifies an explanation request as explain', () => {
    expect(classifyIntent('Explain how retrieval augmented generation works.').intent).toBe('explain')
    expect(classifyIntent('What is a knowledge graph?').intent).toBe('explain')
  })

  it('falls back to ask for a generic question with no other markers', () => {
    expect(classifyIntent('Deep Work').intent).toBe('ask')
  })

  it('falls back to ask with zero confidence for empty input', () => {
    const result = classifyIntent('   ')
    expect(result.intent).toBe('ask')
    expect(result.confidence).toBe(0)
    expect(result.matchedRule).toBe('empty-input')
  })

  it('gives every rule-based match the same fixed confidence', () => {
    expect(classifyIntent('Explain this.').confidence).toBe(0.8)
    expect(classifyIntent('Compare these.').confidence).toBe(0.8)
  })

  it('gives the fallback ask a lower confidence than a matched rule', () => {
    const matched = classifyIntent('Explain this.')
    const fallback = classifyIntent('hello there')
    expect(fallback.confidence).toBeLessThan(matched.confidence)
  })

  it('reports which rule matched, for traceability', () => {
    expect(classifyIntent('Help me plan my week.').matchedRule).toBe('plan')
  })

  it('is case-insensitive', () => {
    expect(classifyIntent('EXPLAIN THIS TO ME').intent).toBe('explain')
  })

  it('prioritizes plan over learn when both markers are present', () => {
    expect(classifyIntent('Help me plan my exam study schedule.').intent).toBe('plan')
  })

  it('is a pure function: the same input always produces the same output', () => {
    const a = classifyIntent('Explain how this works.')
    const b = classifyIntent('Explain how this works.')
    expect(a).toEqual(b)
  })
})
