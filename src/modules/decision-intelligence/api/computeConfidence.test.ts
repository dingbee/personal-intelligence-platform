import { describe, expect, it } from 'vitest'
import { computeConfidence } from '@/modules/decision-intelligence/api/computeConfidence'
import type { AlternativeEvaluation } from '@/modules/decision-intelligence/decision'

function evaluation(alternativeId: string, evidenceIds: string[] = []): AlternativeEvaluation {
  return { alternativeId, criterionId: 'c1', score: 8, rationale: 'r', confidence: 'medium', evidenceIds }
}

describe('computeConfidence', () => {
  it('preserves a low/medium declared confidence unchanged when there are no unknowns', () => {
    const result = computeConfidence({ declaredConfidence: 'medium', recommendedAlternativeId: 'a1', evaluations: [], contextEvidenceCount: 0, unknowns: [] })
    expect(result).toEqual({ confidence: 'medium', provisional: false, provisionalReason: null })
  })

  it('caps a declared "high" confidence to "medium" when no evidence was ever retrieved', () => {
    const result = computeConfidence({ declaredConfidence: 'high', recommendedAlternativeId: 'a1', evaluations: [evaluation('a1')], contextEvidenceCount: 0, unknowns: [] })
    expect(result.confidence).toBe('medium')
    expect(result.provisional).toBe(true)
    expect(result.provisionalReason).toContain('Decision is provisional because')
  })

  it('caps a declared "high" confidence to "medium" when evidence exists but the recommended alternative\'s evaluations cite none of it', () => {
    const result = computeConfidence({ declaredConfidence: 'high', recommendedAlternativeId: 'a1', evaluations: [evaluation('a1', [])], contextEvidenceCount: 3, unknowns: [] })
    expect(result.confidence).toBe('medium')
    expect(result.provisional).toBe(true)
  })

  it('preserves "high" confidence when the recommended alternative has cited evidence', () => {
    const result = computeConfidence({ declaredConfidence: 'high', recommendedAlternativeId: 'a1', evaluations: [evaluation('a1', ['ev-1'])], contextEvidenceCount: 3, unknowns: [] })
    expect(result.confidence).toBe('high')
    expect(result.provisional).toBe(false)
  })

  it('marks the decision provisional whenever there are unresolved unknowns, regardless of confidence', () => {
    const result = computeConfidence({ declaredConfidence: 'low', recommendedAlternativeId: 'a1', evaluations: [], contextEvidenceCount: 0, unknowns: ['budget is not yet finalized'] })
    expect(result.provisional).toBe(true)
    expect(result.provisionalReason).toContain('budget is not yet finalized')
    expect(result.confidence).toBe('low') // unknowns don't change a low confidence that was already honest
  })

  it('combines both reasons when confidence is capped AND unknowns exist', () => {
    const result = computeConfidence({ declaredConfidence: 'high', recommendedAlternativeId: 'a1', evaluations: [], contextEvidenceCount: 0, unknowns: ['timeline unclear'] })
    expect(result.provisionalReason).toContain('capped to medium')
    expect(result.provisionalReason).toContain('timeline unclear')
  })

  it('passes through a null declared confidence unchanged', () => {
    const result = computeConfidence({ declaredConfidence: null, recommendedAlternativeId: null, evaluations: [], contextEvidenceCount: 0, unknowns: [] })
    expect(result.confidence).toBeNull()
    expect(result.provisional).toBe(false)
  })
})
