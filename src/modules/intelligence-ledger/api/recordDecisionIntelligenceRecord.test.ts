import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { Decision } from '@/modules/decision-intelligence/decision'

const { createIntelligenceRecordMock } = vi.hoisted(() => ({
  createIntelligenceRecordMock: vi.fn(),
}))

vi.mock('@/modules/intelligence-ledger/api/createIntelligenceRecord', () => ({ createIntelligenceRecord: createIntelligenceRecordMock }))

import { recordDecisionIntelligenceRecord } from '@/modules/intelligence-ledger/api/recordDecisionIntelligenceRecord'

// A real Decision, built the same way computeWeightedScores/validateDecision would leave one —
// this exercises the actual decisionIntelligenceAdapter.ts, not a mocked provenance shape.
function realDecision(overrides: Partial<Decision> = {}): Decision {
  return {
    id: 'decision-1',
    title: 'Decision: switch pricing model?',
    question: 'Should we switch to usage-based pricing?',
    objective: 'Grow revenue without hurting retention',
    status: 'complete',
    alternatives: [
      { id: 'alt-1', title: 'Usage-based', description: 'Charge per unit consumed', advantages: [], disadvantages: [], estimatedImpact: null, risks: [], evidenceIds: ['evidence-1'] },
    ],
    criteria: [{ id: 'crit-1', name: 'Revenue impact', description: 'Expected effect on revenue', weight: 1, importance: 'high', evaluationMethod: null }],
    evaluations: [{ alternativeId: 'alt-1', criterionId: 'crit-1', score: 8, rationale: 'Usage growth has been steady per Q3 report', evidenceIds: ['evidence-1'], confidence: 'medium' }],
    weightedScores: [{ alternativeId: 'alt-1', totalScore: 8, breakdown: [{ criterionId: 'crit-1', normalizedWeight: 1, score: 8, contribution: 8 }], missingCriterionIds: [] }],
    recommendedAlternativeId: 'alt-1',
    confidence: 'medium',
    rationale: 'Usage-based pricing tracks demonstrated Q3 usage growth.',
    tradeoffs: [],
    risks: [],
    assumptions: [],
    constraints: [],
    unknowns: [],
    consequences: [],
    sensitivity: [],
    nextAction: null,
    contextEvidence: [{ id: 'evidence-1', type: 'document', title: 'Q3 usage report', excerpt: 'Usage grew 22% quarter over quarter.' }],
    datasetInvestigation: null,
    provisional: false,
    provisionalReason: null,
    validationIssues: [],
    budgetExhausted: false,
    generationFailed: false,
    declineReason: null,
    workspaceId: 'workspace-1',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('recordDecisionIntelligenceRecord', () => {
  beforeEach(() => createIntelligenceRecordMock.mockReset())

  it('persists a real Decision through the actual decisionIntelligenceAdapter, not a mocked provenance shape', async () => {
    createIntelligenceRecordMock.mockResolvedValueOnce({ id: 'record-1' })

    await recordDecisionIntelligenceRecord({ decision: realDecision(), workspaceId: 'workspace-1', operationId: 'operation-1', providerId: 'openai' })

    expect(createIntelligenceRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace-1',
        recordType: 'decision',
        summary: 'Decision: Decision: switch pricing model?',
        operationId: 'operation-1',
        providerId: 'openai',
        structuredOutput: expect.objectContaining({ id: 'decision-1' }),
      }),
    )

    const call = createIntelligenceRecordMock.mock.calls[0]![0]
    // The real adapter's output: one evidence-backed evaluation -> one 'observation' derivation, plus one closing 'synthesis'.
    expect(call.provenance.evidence).toEqual([{ id: 'evidence-1', source: { type: 'document', id: 'evidence-1', title: 'Q3 usage report' }, location: { kind: 'whole' }, excerpt: 'Usage grew 22% quarter over quarter.', retrievedAt: null }])
    expect(call.provenance.derivations).toHaveLength(2)
    expect(call.provenance.derivations[0]).toMatchObject({ kind: 'observation', evidenceIds: ['evidence-1'] })
    expect(call.provenance.derivations[1]).toMatchObject({ kind: 'synthesis', statement: 'Usage-based pricing tracks demonstrated Q3 usage growth.' })
  })

  it('uses the decision real nextAction as expectedOutcome when one was resolved', async () => {
    createIntelligenceRecordMock.mockResolvedValueOnce({ id: 'record-1' })

    await recordDecisionIntelligenceRecord({ decision: realDecision({ nextAction: 'Roll out usage-based pricing to the pilot cohort.' }), workspaceId: 'workspace-1', operationId: 'operation-1', providerId: 'openai' })

    expect(createIntelligenceRecordMock.mock.calls[0]![0].expectedOutcome).toBe('Roll out usage-based pricing to the pilot cohort.')
  })

  it('never fabricates an expectedOutcome when the decision has no resolved nextAction', async () => {
    createIntelligenceRecordMock.mockResolvedValueOnce({ id: 'record-1' })

    await recordDecisionIntelligenceRecord({ decision: realDecision({ nextAction: null }), workspaceId: 'workspace-1', operationId: 'operation-1', providerId: 'openai' })

    expect(createIntelligenceRecordMock.mock.calls[0]![0].expectedOutcome).toBeNull()
  })

  it('never sets a parentRecordId — Decision Intelligence has no real originating Ledger record id to cite', async () => {
    createIntelligenceRecordMock.mockResolvedValueOnce({ id: 'record-1' })

    await recordDecisionIntelligenceRecord({ decision: realDecision(), workspaceId: 'workspace-1', operationId: 'operation-1', providerId: 'openai' })

    const call = createIntelligenceRecordMock.mock.calls[0]![0]
    expect(call.parentRecordId).toBeUndefined()
  })

  it('produces empty provenance for an evaluation with no cited evidence — never a derivation grounded in nothing', async () => {
    createIntelligenceRecordMock.mockResolvedValueOnce({ id: 'record-1' })
    const decision = realDecision({
      evaluations: [{ alternativeId: 'alt-1', criterionId: 'crit-1', score: 5, rationale: 'unsupported guess', evidenceIds: [], confidence: 'low' }],
    })

    await recordDecisionIntelligenceRecord({ decision, workspaceId: 'workspace-1', operationId: 'operation-1', providerId: 'openai' })

    const call = createIntelligenceRecordMock.mock.calls[0]![0]
    expect(call.provenance.derivations).toEqual([])
  })
})
