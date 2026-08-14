import { describe, expect, it } from 'vitest'
import { computeSensitivity } from '@/modules/decision-intelligence/api/computeSensitivity'
import { computeWeightedScores } from '@/modules/decision-intelligence/api/computeWeightedScores'
import type { Alternative, AlternativeEvaluation, DecisionAssumption, DecisionCriterion, WeightedScore } from '@/modules/decision-intelligence/decision'

function alt(id: string, title = id): Alternative {
  return { id, title, description: '', advantages: [], disadvantages: [], estimatedImpact: null, risks: [], evidenceIds: [] }
}
function criterion(id: string, weight: number, name = id): DecisionCriterion {
  return { id, name, description: '', weight, importance: 'medium', evaluationMethod: null }
}
function evaluation(alternativeId: string, criterionId: string, score: number): AlternativeEvaluation {
  return { alternativeId, criterionId, score, rationale: 'r', evidenceIds: [], confidence: 'medium' }
}
function weightedScore(alternativeId: string, totalScore: number): WeightedScore {
  return { alternativeId, totalScore, breakdown: [], missingCriterionIds: [] }
}

describe('computeSensitivity', () => {
  it('flags criterion_influence when removing a criterion changes the leading alternative', () => {
    const criteria = [criterion('c1', 1), criterion('c2', 1)]
    const alternatives = [alt('a1', 'Alt A'), alt('a2', 'Alt B')]
    const evaluations = [evaluation('a1', 'c1', 6), evaluation('a1', 'c2', 4), evaluation('a2', 'c1', 4), evaluation('a2', 'c2', 8)]
    const weightedScores = computeWeightedScores(criteria, alternatives, evaluations)
    // Baseline: a1=5, a2=6 -> a2 leads. Removing c2 leaves only c1: a1=6, a2=4 -> a1 leads (flip).
    // Removing c1 leaves only c2: a1=4, a2=8 -> a2 still leads (no flip).

    const insights = computeSensitivity({ criteria, alternatives, evaluations, weightedScores, assumptions: [], unknowns: [] })
    const criterionInsights = insights.filter((i) => i.kind === 'criterion_influence')
    expect(criterionInsights).toHaveLength(1)
    expect(criterionInsights[0]!.description).toContain('c2')
  })

  it('does not flag criterion_influence when no single criterion removal changes the leader', () => {
    const criteria = [criterion('c1', 1), criterion('c2', 1)]
    const alternatives = [alt('a1'), alt('a2')]
    const evaluations = [evaluation('a1', 'c1', 9), evaluation('a1', 'c2', 9), evaluation('a2', 'c1', 1), evaluation('a2', 'c2', 1)]
    const weightedScores = computeWeightedScores(criteria, alternatives, evaluations)

    const insights = computeSensitivity({ criteria, alternatives, evaluations, weightedScores, assumptions: [], unknowns: [] })
    expect(insights.filter((i) => i.kind === 'criterion_influence')).toEqual([])
  })

  it('computes a real weight_change_reversal breakeven point between the top two alternatives', () => {
    const criteria = [criterion('c1', 6, 'Cost'), criterion('c2', 4, 'Quality')]
    const alternatives = [alt('a1', 'Alternative A'), alt('a2', 'Alternative B')]
    const evaluations = [evaluation('a1', 'c1', 8), evaluation('a1', 'c2', 2), evaluation('a2', 'c1', 4), evaluation('a2', 'c2', 9)]
    const weightedScores = computeWeightedScores(criteria, alternatives, evaluations)
    // a1 = 0.6*8+0.4*2 = 5.6, a2 = 0.6*4+0.4*9 = 6.0 -> a2 leads.

    const insights = computeSensitivity({ criteria, alternatives, evaluations, weightedScores, assumptions: [], unknowns: [] })
    const reversal = insights.find((i) => i.kind === 'weight_change_reversal')
    expect(reversal).toBeDefined()
    expect(reversal!.description).toContain('Quality')
    expect(reversal!.description).toContain('Alternative A')
    expect(reversal!.affectedAlternativeIds.sort()).toEqual(['a1', 'a2'])
  })

  it('produces no sensitivity insights beyond missing-information when there are fewer than two alternatives', () => {
    const weightedScores = [weightedScore('a1', 5)]
    const insights = computeSensitivity({ criteria: [], alternatives: [], evaluations: [], weightedScores, assumptions: [{ id: 'as1', statement: 'x', origin: 'assumed', impactIfFalse: null, evidenceIds: [] }], unknowns: [] })
    expect(insights).toEqual([])
  })

  it('flags every non-known assumption as a reversal risk when the top two alternatives are close', () => {
    const weightedScores = [weightedScore('a1', 7.0), weightedScore('a2', 6.7)] // 0.3 apart, within threshold
    const assumptions: DecisionAssumption[] = [
      { id: 'as1', statement: 'Assumed thing', origin: 'assumed', impactIfFalse: null, evidenceIds: [] },
      { id: 'as2', statement: 'Known thing', origin: 'known', impactIfFalse: null, evidenceIds: [] },
    ]
    const insights = computeSensitivity({ criteria: [], alternatives: [], evaluations: [], weightedScores, assumptions, unknowns: [] })
    const reversalInsights = insights.filter((i) => i.kind === 'assumption_reversal_risk')
    expect(reversalInsights).toHaveLength(1)
    expect(reversalInsights[0]!.description).toContain('Assumed thing')
  })

  it('does not flag assumption reversal risk when the top two alternatives are far apart', () => {
    const weightedScores = [weightedScore('a1', 9.0), weightedScore('a2', 2.0)]
    const assumptions: DecisionAssumption[] = [{ id: 'as1', statement: 'x', origin: 'assumed', impactIfFalse: null, evidenceIds: [] }]
    const insights = computeSensitivity({ criteria: [], alternatives: [], evaluations: [], weightedScores, assumptions, unknowns: [] })
    expect(insights.filter((i) => i.kind === 'assumption_reversal_risk')).toEqual([])
  })

  it('flags every unknown as missing_information_impact regardless of score closeness', () => {
    const weightedScores = [weightedScore('a1', 9.0), weightedScore('a2', 2.0)]
    const insights = computeSensitivity({ criteria: [], alternatives: [], evaluations: [], weightedScores, assumptions: [], unknowns: ['budget not finalized', 'timeline unclear'] })
    const missingInfo = insights.filter((i) => i.kind === 'missing_information_impact')
    expect(missingInfo).toHaveLength(2)
    expect(missingInfo.map((i) => i.description)).toEqual(['Missing information: budget not finalized', 'Missing information: timeline unclear'])
  })
})
