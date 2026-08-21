import { describe, expect, it } from 'vitest'
import { decisionToProvenance } from '@/shared/provenance/adapters/decisionIntelligenceAdapter'
import type { Decision } from '@/modules/decision-intelligence/decision'

function baseDecision(overrides: Partial<Decision> = {}): Decision {
  return {
    id: 'decision-1',
    title: 'A Decision',
    question: 'Which option?',
    objective: 'Grow',
    status: 'complete',
    alternatives: [
      { id: 'a1', title: 'Alt A', description: '', advantages: [], disadvantages: [], estimatedImpact: null, risks: [], evidenceIds: [] },
      { id: 'a2', title: 'Alt B', description: '', advantages: [], disadvantages: [], estimatedImpact: null, risks: [], evidenceIds: [] },
    ],
    criteria: [{ id: 'c1', name: 'Cost', description: '', weight: 1, importance: 'medium', evaluationMethod: null }],
    evaluations: [],
    weightedScores: [],
    recommendedAlternativeId: 'a1',
    confidence: 'medium',
    rationale: 'a1 is the better fit',
    tradeoffs: [],
    risks: [],
    assumptions: [],
    constraints: [],
    unknowns: [],
    consequences: [],
    sensitivity: [],
    nextAction: null,
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

describe('decisionToProvenance', () => {
  it('returns an empty chain when there is no context evidence and no cited evaluations', () => {
    const chain = decisionToProvenance(baseDecision())
    expect(chain).toEqual({ evidence: [], derivations: [] })
  })

  it('maps context evidence to EvidenceReferences, preserving the verbatim excerpt', () => {
    const decision = baseDecision({ contextEvidence: [{ id: 'src-1', type: 'note', title: 'My Note', excerpt: 'Verbatim text.' }] })
    const chain = decisionToProvenance(decision)
    expect(chain.evidence).toEqual([{ id: 'src-1', source: { type: 'note', title: 'My Note', id: 'src-1' }, location: { kind: 'whole' }, excerpt: 'Verbatim text.', retrievedAt: null }])
  })

  it('produces one observation derivation per evidence-backed evaluation, and none for an evaluation with no citations', () => {
    const decision = baseDecision({
      contextEvidence: [{ id: 'src-1', type: 'document', title: 'Doc', excerpt: 'e' }],
      evaluations: [
        { alternativeId: 'a1', criterionId: 'c1', score: 8, rationale: 'because of the doc', evidenceIds: ['src-1'], confidence: 'high' },
        { alternativeId: 'a2', criterionId: 'c1', score: 3, rationale: 'pure judgment', evidenceIds: [], confidence: 'low' },
      ],
    })
    const chain = decisionToProvenance(decision)
    expect(chain.derivations.filter((d) => d.kind === 'observation')).toHaveLength(1)
    const obs = chain.derivations.find((d) => d.kind === 'observation')!
    expect(obs.evidenceIds).toEqual(['src-1'])
    expect(obs.statement).toContain('Alt A')
    expect(obs.statement).toContain('Cost')
  })

  it('produces a synthesis derivation based on the observation derivations when the decision is complete with a rationale', () => {
    const decision = baseDecision({
      contextEvidence: [{ id: 'src-1', type: 'document', title: 'Doc', excerpt: 'e' }],
      evaluations: [{ alternativeId: 'a1', criterionId: 'c1', score: 8, rationale: 'r', evidenceIds: ['src-1'], confidence: 'high' }],
    })
    const chain = decisionToProvenance(decision)
    const synthesis = chain.derivations.find((d) => d.kind === 'synthesis')
    expect(synthesis).toBeDefined()
    expect(synthesis!.statement).toBe('a1 is the better fit')
    expect(synthesis!.basedOnDerivationIds).toHaveLength(1)
  })

  it('does not produce a synthesis derivation for a declined or failed decision, even with evidence present', () => {
    const decision = baseDecision({
      status: 'declined',
      declineReason: 'Too vague.',
      contextEvidence: [{ id: 'src-1', type: 'document', title: 'Doc', excerpt: 'e' }],
      evaluations: [{ alternativeId: 'a1', criterionId: 'c1', score: 8, rationale: 'r', evidenceIds: ['src-1'], confidence: 'high' }],
    })
    const chain = decisionToProvenance(decision)
    expect(chain.derivations.some((d) => d.kind === 'synthesis')).toBe(false)
    // The observation derivation and evidence are still real and reportable.
    expect(chain.derivations.some((d) => d.kind === 'observation')).toBe(true)
  })
})
