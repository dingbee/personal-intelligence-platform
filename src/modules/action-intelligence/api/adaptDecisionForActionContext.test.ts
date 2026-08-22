import { describe, expect, it } from 'vitest'
import { adaptDecisionForActionContext } from '@/modules/action-intelligence/api/adaptDecisionForActionContext'
import type { Decision } from '@/modules/decision-intelligence/decision'

function baseDecision(overrides: Partial<Decision> = {}): Decision {
  return {
    id: 'decision-1',
    title: 'A Decision',
    question: 'Which launch strategy?',
    objective: 'Grow',
    status: 'complete',
    alternatives: [
      { id: 'a1', title: 'Student-first', description: '', advantages: [], disadvantages: [], estimatedImpact: null, risks: [], evidenceIds: [] },
      { id: 'a2', title: 'Lecturer-first', description: '', advantages: [], disadvantages: [], estimatedImpact: null, risks: [], evidenceIds: [] },
    ],
    criteria: [],
    evaluations: [],
    weightedScores: [],
    recommendedAlternativeId: 'a1',
    confidence: 'medium',
    rationale: 'Students adopt faster.',
    tradeoffs: [],
    risks: [{ id: 'r1', description: 'Students may churn', likelihood: 'medium', impact: 'medium', mitigation: null, evidenceIds: [] }],
    assumptions: [],
    constraints: [],
    unknowns: [],
    consequences: [],
    sensitivity: [],
    nextAction: 'Prepare a student-focused launch campaign',
    contextEvidence: [],
    datasetInvestigation: null,
    provisional: false,
    provisionalReason: null,
    validationIssues: [],
    budgetExhausted: false,
    generationFailed: false,
    declineReason: null,
    workspaceId: 'workspace-1',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('adaptDecisionForActionContext', () => {
  it("maps a completed Decision's question/recommendation/rationale/nextAction/risks/provisional into the action-context shape", () => {
    const decision = baseDecision()
    const context = adaptDecisionForActionContext(decision)

    expect(context).toEqual({
      decisionId: 'decision-1',
      decisionQuestion: 'Which launch strategy?',
      recommendedAlternative: 'Student-first',
      rationale: 'Students adopt faster.',
      nextAction: 'Prepare a student-focused launch campaign',
      relevantRisks: ['Students may churn'],
      provisional: false,
    })
  })

  it('never fabricates a recommendation for a decision with no resolved recommendedAlternativeId', () => {
    const decision = baseDecision({ recommendedAlternativeId: null, status: 'declined', declineReason: 'Not enough alternatives.' })
    const context = adaptDecisionForActionContext(decision)
    expect(context.recommendedAlternative).toBeNull()
  })

  it('carries the provisional flag through so downstream actions inherit the same uncertainty', () => {
    const decision = baseDecision({ provisional: true, provisionalReason: 'Missing budget info' })
    const context = adaptDecisionForActionContext(decision)
    expect(context.provisional).toBe(true)
  })

  it('does not mutate or reference the original Decision object after mapping', () => {
    const decision = baseDecision()
    const context = adaptDecisionForActionContext(decision)
    decision.risks.push({ id: 'r2', description: 'A later risk', likelihood: 'low', impact: 'low', mitigation: null, evidenceIds: [] })
    expect(context.relevantRisks).toEqual(['Students may churn'])
  })
})
