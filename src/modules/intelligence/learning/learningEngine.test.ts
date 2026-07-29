import { describe, expect, it } from 'vitest'
import { detectLearningIntelligence } from '@/modules/intelligence/learning/learningEngine'
import type { DocumentJourney } from '@/modules/reader/intelligence/documentJourney'

function journey(overrides: Partial<DocumentJourney> = {}): DocumentJourney {
  return { status: 'started', summarizedChapterCount: 0, flashcardCount: 0, notesAddedCount: 0, questionsAskedCount: 0, ...overrides }
}

describe('detectLearningIntelligence', () => {
  it('returns null for a non-learning intent', () => {
    expect(detectLearningIntelligence({ intent: 'search', journey: journey(), unreviewedHighlightCount: 0 })).toBeNull()
  })

  it('returns null when there is no document journey at all', () => {
    expect(detectLearningIntelligence({ intent: 'learn', journey: null, unreviewedHighlightCount: 0 })).toBeNull()
  })

  it('detects the starting stage for a not-yet-started document', () => {
    const result = detectLearningIntelligence({ intent: 'learn', journey: journey({ status: 'not_started' }), unreviewedHighlightCount: 0 })
    expect(result?.stage).toBe('starting')
  })

  it('detects the in_progress stage for a document actively being read', () => {
    const result = detectLearningIntelligence({ intent: 'learn', journey: journey({ status: 'started' }), unreviewedHighlightCount: 0 })
    expect(result?.stage).toBe('in_progress')
  })

  it('detects the reviewing stage for a paused document', () => {
    const result = detectLearningIntelligence({ intent: 'review', journey: journey({ status: 'paused' }), unreviewedHighlightCount: 0 })
    expect(result?.stage).toBe('reviewing')
  })

  it('detects the practicing stage for a completed document with modest activity', () => {
    const result = detectLearningIntelligence({
      intent: 'learn',
      journey: journey({ status: 'completed', flashcardCount: 2 }),
      unreviewedHighlightCount: 0,
    })
    expect(result?.stage).toBe('practicing')
  })

  it('detects the mastered stage for a completed document with heavy activity', () => {
    const result = detectLearningIntelligence({
      intent: 'learn',
      journey: journey({ status: 'completed', flashcardCount: 5, summarizedChapterCount: 3, notesAddedCount: 3 }),
      unreviewedHighlightCount: 0,
    })
    expect(result?.stage).toBe('mastered')
  })

  it('reports a novice knowledge level with no activity', () => {
    const result = detectLearningIntelligence({ intent: 'learn', journey: journey(), unreviewedHighlightCount: 0 })
    expect(result?.knowledgeLevel).toBe('novice')
  })

  it('reports a developing knowledge level with moderate activity', () => {
    const result = detectLearningIntelligence({ intent: 'learn', journey: journey({ flashcardCount: 3 }), unreviewedHighlightCount: 0 })
    expect(result?.knowledgeLevel).toBe('developing')
  })

  it('reports a proficient knowledge level with heavy activity', () => {
    const result = detectLearningIntelligence({
      intent: 'learn',
      journey: journey({ flashcardCount: 5, summarizedChapterCount: 3, notesAddedCount: 3 }),
      unreviewedHighlightCount: 0,
    })
    expect(result?.knowledgeLevel).toBe('proficient')
  })

  it('flags a review opportunity when there are unreviewed highlights', () => {
    const result = detectLearningIntelligence({ intent: 'learn', journey: journey(), unreviewedHighlightCount: 3 })
    expect(result?.reviewOpportunity).toBe(true)
  })

  it('does not flag a review opportunity with nothing unreviewed', () => {
    const result = detectLearningIntelligence({ intent: 'learn', journey: journey(), unreviewedHighlightCount: 0 })
    expect(result?.reviewOpportunity).toBe(false)
  })

  it('flags a practice opportunity for an in-progress document with few flashcards', () => {
    const result = detectLearningIntelligence({ intent: 'learn', journey: journey({ status: 'started', flashcardCount: 0 }), unreviewedHighlightCount: 0 })
    expect(result?.practiceOpportunity).toBe(true)
  })

  it('does not flag a practice opportunity once there are already plenty of flashcards', () => {
    const result = detectLearningIntelligence({ intent: 'learn', journey: journey({ status: 'started', flashcardCount: 8 }), unreviewedHighlightCount: 0 })
    expect(result?.practiceOpportunity).toBe(false)
  })

  it('gives every stage a suggested next step', () => {
    const result = detectLearningIntelligence({ intent: 'learn', journey: journey({ status: 'not_started' }), unreviewedHighlightCount: 0 })
    expect(result?.suggestedNextStep.length).toBeGreaterThan(0)
  })

  it('is a pure function of its inputs', () => {
    const input = { intent: 'learn' as const, journey: journey({ status: 'started' }), unreviewedHighlightCount: 1 }
    expect(detectLearningIntelligence(input)).toEqual(detectLearningIntelligence(input))
  })
})
