import { describe, expect, it } from 'vitest'
import { validateDecision } from '@/modules/decision-intelligence/api/validateDecision'
import { computeWeightedScores } from '@/modules/decision-intelligence/api/computeWeightedScores'
import type { ParsedDecisionFields } from '@/modules/decision-intelligence/api/parseDecisionResponse'
import type { Alternative, AlternativeEvaluation, DecisionCriterion } from '@/modules/decision-intelligence/decision'

function alt(id: string, title = id): Alternative {
  return { id, title, description: '', advantages: [], disadvantages: [], estimatedImpact: null, risks: [], evidenceIds: [] }
}
function criterion(id: string, weight: number, name = id): DecisionCriterion {
  return { id, name, description: '', weight, importance: 'medium', evaluationMethod: null }
}
function evaluation(alternativeId: string, criterionId: string, score: number, evidenceIds: string[] = []): AlternativeEvaluation {
  return { alternativeId, criterionId, score, rationale: 'r', evidenceIds, confidence: 'medium' }
}

function baseFields(overrides: Partial<ParsedDecisionFields> = {}): ParsedDecisionFields {
  return {
    title: 'Decision',
    alternatives: [alt('a1'), alt('a2')],
    criteria: [criterion('c1', 1)],
    evaluations: [evaluation('a1', 'c1', 8), evaluation('a2', 'c1', 3)],
    risks: [],
    assumptions: [],
    constraints: [],
    unknowns: [],
    consequences: [],
    recommendedAlternativeId: 'a1',
    confidence: 'medium',
    rationale: 'because a1 scores higher',
    tradeoffs: [],
    nextAction: null,
    ...overrides,
  }
}

describe('validateDecision', () => {
  it('is clean for a well-formed, internally consistent decision', () => {
    const fields = baseFields()
    const weightedScores = computeWeightedScores(fields.criteria, fields.alternatives, fields.evaluations)
    expect(validateDecision({ question: 'Which?', objective: 'Grow', fields, weightedScores, contextEvidenceCount: 0 })).toEqual([])
  })

  it('reports missing_question for a blank question', () => {
    const fields = baseFields()
    const issues = validateDecision({ question: '   ', objective: 'x', fields, weightedScores: [], contextEvidenceCount: 0 })
    expect(issues.some((i) => i.kind === 'missing_question')).toBe(true)
  })

  it('reports missing_objective when no objective is supplied', () => {
    const fields = baseFields()
    const issues = validateDecision({ question: 'Which?', objective: null, fields, weightedScores: [], contextEvidenceCount: 0 })
    expect(issues.some((i) => i.kind === 'missing_objective')).toBe(true)
  })

  it('reports insufficient_alternatives when there are fewer than two', () => {
    const fields = baseFields({ alternatives: [alt('a1')] })
    const issues = validateDecision({ question: 'Which?', objective: 'x', fields, weightedScores: [], contextEvidenceCount: 0 })
    expect(issues.some((i) => i.kind === 'insufficient_alternatives')).toBe(true)
  })

  it('reports missing_criteria when there are none', () => {
    const fields = baseFields({ criteria: [] })
    const issues = validateDecision({ question: 'Which?', objective: 'x', fields, weightedScores: [], contextEvidenceCount: 0 })
    expect(issues.some((i) => i.kind === 'missing_criteria')).toBe(true)
  })

  it('reports invalid_criterion_weight for a non-positive weight', () => {
    const fields = baseFields({ criteria: [criterion('c1', 0)] })
    const issues = validateDecision({ question: 'Which?', objective: 'x', fields, weightedScores: [], contextEvidenceCount: 0 })
    expect(issues.some((i) => i.kind === 'invalid_criterion_weight' && i.affectedIds.includes('c1'))).toBe(true)
  })

  it('reports dangling_alternative_reference and dangling_criterion_reference for an evaluation naming ids not in the decision', () => {
    const fields = baseFields({ evaluations: [evaluation('ghost-alt', 'ghost-criterion', 5)] })
    const issues = validateDecision({ question: 'Which?', objective: 'x', fields, weightedScores: [], contextEvidenceCount: 0 })
    expect(issues.some((i) => i.kind === 'dangling_alternative_reference')).toBe(true)
    expect(issues.some((i) => i.kind === 'dangling_criterion_reference')).toBe(true)
  })

  it('reports invalid_score for an evaluation outside the 0-10 range', () => {
    const fields = baseFields({ evaluations: [evaluation('a1', 'c1', 15)] })
    const issues = validateDecision({ question: 'Which?', objective: 'x', fields, weightedScores: [], contextEvidenceCount: 0 })
    expect(issues.some((i) => i.kind === 'invalid_score')).toBe(true)
  })

  it('reports missing_evaluation for an alternative with no evaluations at all', () => {
    const fields = baseFields({ alternatives: [alt('a1'), alt('a2'), alt('a3')], evaluations: [evaluation('a1', 'c1', 8)] })
    const issues = validateDecision({ question: 'Which?', objective: 'x', fields, weightedScores: [], contextEvidenceCount: 0 })
    expect(issues.some((i) => i.kind === 'missing_evaluation' && i.affectedIds.includes('a2'))).toBe(true)
    expect(issues.some((i) => i.kind === 'missing_evaluation' && i.affectedIds.includes('a3'))).toBe(true)
  })

  it('reports recommendation_references_unknown_alternative when the recommendation is null', () => {
    const fields = baseFields({ recommendedAlternativeId: null })
    const issues = validateDecision({ question: 'Which?', objective: 'x', fields, weightedScores: [], contextEvidenceCount: 0 })
    expect(issues.some((i) => i.kind === 'recommendation_references_unknown_alternative')).toBe(true)
  })

  it('reports recommendation_references_unknown_alternative when the recommendation names an id not in alternatives', () => {
    const fields = baseFields({ recommendedAlternativeId: 'ghost' })
    const issues = validateDecision({ question: 'Which?', objective: 'x', fields, weightedScores: [], contextEvidenceCount: 0 })
    expect(issues.some((i) => i.kind === 'recommendation_references_unknown_alternative')).toBe(true)
  })

  it('reports missing_rationale when there is none', () => {
    const fields = baseFields({ rationale: null })
    const issues = validateDecision({ question: 'Which?', objective: 'x', fields, weightedScores: [], contextEvidenceCount: 0 })
    expect(issues.some((i) => i.kind === 'missing_rationale')).toBe(true)
  })

  it('reports missing_evidence_for_claim when evidence existed but the recommendation cites none of it', () => {
    const fields = baseFields() // evaluations have no evidenceIds
    const issues = validateDecision({ question: 'Which?', objective: 'x', fields, weightedScores: [], contextEvidenceCount: 3 })
    expect(issues.some((i) => i.kind === 'missing_evidence_for_claim')).toBe(true)
  })

  it('does not report missing_evidence_for_claim when no evidence was ever retrieved (nothing to have cited)', () => {
    const fields = baseFields()
    const issues = validateDecision({ question: 'Which?', objective: 'x', fields, weightedScores: [], contextEvidenceCount: 0 })
    expect(issues.some((i) => i.kind === 'missing_evidence_for_claim')).toBe(false)
  })

  it('reports unsupported_certainty for a "high" confidence claim with no cited evidence backing the recommendation', () => {
    const fields = baseFields({ confidence: 'high' })
    const issues = validateDecision({ question: 'Which?', objective: 'x', fields, weightedScores: [], contextEvidenceCount: 3 })
    expect(issues.some((i) => i.kind === 'unsupported_certainty')).toBe(true)
  })

  it('does not report unsupported_certainty for "high" confidence when the recommendation genuinely cites evidence', () => {
    const fields = baseFields({ confidence: 'high', evaluations: [evaluation('a1', 'c1', 8, ['ev-1']), evaluation('a2', 'c1', 3)] })
    const issues = validateDecision({ question: 'Which?', objective: 'x', fields, weightedScores: [], contextEvidenceCount: 3 })
    expect(issues.some((i) => i.kind === 'unsupported_certainty')).toBe(false)
  })

  it('reports contradictory_recommendation when the model\'s pick differs from the deterministically highest-scoring alternative', () => {
    // a2 scores higher (9) than a1 (2), but the model recommends a1.
    const fields = baseFields({ evaluations: [evaluation('a1', 'c1', 2), evaluation('a2', 'c1', 9)], recommendedAlternativeId: 'a1' })
    const weightedScores = computeWeightedScores(fields.criteria, fields.alternatives, fields.evaluations)
    const issues = validateDecision({ question: 'Which?', objective: 'x', fields, weightedScores, contextEvidenceCount: 0 })
    const issue = issues.find((i) => i.kind === 'contradictory_recommendation')
    expect(issue).toBeDefined()
    expect(issue!.affectedIds.sort()).toEqual(['a1', 'a2'])
  })

  it('does not report contradictory_recommendation when the model\'s pick matches the top-scoring alternative', () => {
    const fields = baseFields() // a1 scores 8, a2 scores 3; recommends a1
    const weightedScores = computeWeightedScores(fields.criteria, fields.alternatives, fields.evaluations)
    const issues = validateDecision({ question: 'Which?', objective: 'x', fields, weightedScores, contextEvidenceCount: 0 })
    expect(issues.some((i) => i.kind === 'contradictory_recommendation')).toBe(false)
  })

  it('flags duplicate_id when two alternatives share an id', () => {
    const fields = baseFields({ alternatives: [alt('a1'), alt('a1')] })
    const issues = validateDecision({ question: 'Which?', objective: 'x', fields, weightedScores: [], contextEvidenceCount: 0 })
    expect(issues.some((i) => i.kind === 'duplicate_id')).toBe(true)
  })
})
