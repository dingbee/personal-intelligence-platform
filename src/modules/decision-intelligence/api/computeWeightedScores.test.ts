import { describe, expect, it } from 'vitest'
import { computeWeightedScores } from '@/modules/decision-intelligence/api/computeWeightedScores'
import type { Alternative, AlternativeEvaluation, DecisionCriterion } from '@/modules/decision-intelligence/decision'

function alt(id: string, title = id): Alternative {
  return { id, title, description: '', advantages: [], disadvantages: [], estimatedImpact: null, risks: [], evidenceIds: [] }
}
function criterion(id: string, weight: number, name = id): DecisionCriterion {
  return { id, name, description: '', weight, importance: 'medium', evaluationMethod: null }
}
function evaluation(alternativeId: string, criterionId: string, score: number): AlternativeEvaluation {
  return { alternativeId, criterionId, score, rationale: 'because', evidenceIds: [], confidence: 'medium' }
}

describe('computeWeightedScores', () => {
  it('computes weighted total = sum(normalizedWeight * score)', () => {
    const criteria = [criterion('c1', 3), criterion('c2', 1)] // normalized: 0.75, 0.25
    const alternatives = [alt('a1')]
    const evaluations = [evaluation('a1', 'c1', 8), evaluation('a1', 'c2', 2)]

    const [score] = computeWeightedScores(criteria, alternatives, evaluations)
    expect(score!.totalScore).toBeCloseTo(0.75 * 8 + 0.25 * 2, 5)
  })

  it('excludes non-positive weights from normalization entirely, never treating them as zero-influence silently', () => {
    const criteria = [criterion('c1', 5), criterion('c2', -1), criterion('c3', 0)]
    const alternatives = [alt('a1')]
    const evaluations = [evaluation('a1', 'c1', 10), evaluation('a1', 'c2', 10), evaluation('a1', 'c3', 10)]

    const [score] = computeWeightedScores(criteria, alternatives, evaluations)
    // Only c1 (weight 5) participates -> normalized weight 1.0 -> total = 10.
    expect(score!.totalScore).toBeCloseTo(10, 5)
    expect(score!.breakdown).toHaveLength(1)
    expect(score!.breakdown[0]!.criterionId).toBe('c1')
  })

  it('returns an empty array when there are no valid (positive-weight) criteria at all', () => {
    const criteria = [criterion('c1', 0)]
    expect(computeWeightedScores(criteria, [alt('a1')], [])).toEqual([])
  })

  it('records missing criteria per alternative rather than fabricating a score for them', () => {
    const criteria = [criterion('c1', 1), criterion('c2', 1)]
    const alternatives = [alt('a1')]
    const evaluations = [evaluation('a1', 'c1', 5)] // c2 never evaluated

    const [score] = computeWeightedScores(criteria, alternatives, evaluations)
    expect(score!.missingCriterionIds).toEqual(['c2'])
    // Total only reflects the one present evaluation's contribution (weight normalized over BOTH valid criteria, so 0.5 * 5).
    expect(score!.totalScore).toBeCloseTo(0.5 * 5, 5)
  })

  it('ranks two alternatives correctly by their computed totals', () => {
    const criteria = [criterion('c1', 1)]
    const alternatives = [alt('a1'), alt('a2')]
    const evaluations = [evaluation('a1', 'c1', 3), evaluation('a2', 'c1', 9)]

    const scores = computeWeightedScores(criteria, alternatives, evaluations)
    const ranked = [...scores].sort((a, b) => b.totalScore - a.totalScore)
    expect(ranked[0]!.alternativeId).toBe('a2')
  })

  it('produces one WeightedScore per alternative even when an alternative has zero evaluations', () => {
    const criteria = [criterion('c1', 1)]
    const alternatives = [alt('a1'), alt('a2')]
    const evaluations = [evaluation('a1', 'c1', 5)]

    const scores = computeWeightedScores(criteria, alternatives, evaluations)
    expect(scores).toHaveLength(2)
    const a2Score = scores.find((s) => s.alternativeId === 'a2')!
    expect(a2Score.totalScore).toBe(0)
    expect(a2Score.missingCriterionIds).toEqual(['c1'])
  })
})
