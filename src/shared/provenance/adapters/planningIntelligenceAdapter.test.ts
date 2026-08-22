import { describe, expect, it } from 'vitest'
import { planToProvenance } from '@/shared/provenance/adapters/planningIntelligenceAdapter'
import type { Plan, PlanDecision } from '@/modules/planning-intelligence/plan'
import type { Decision } from '@/modules/decision-intelligence/decision'

function basePlan(overrides: Partial<Plan> = {}): Plan {
  return {
    id: 'plan-1',
    title: 'A Plan',
    objective: 'Do the thing',
    description: null,
    status: 'complete',
    currentState: null,
    desiredOutcome: null,
    gapAnalysis: 'The gap.',
    assumptions: [],
    constraints: [],
    objectives: [],
    workstreams: [],
    milestones: [],
    tasks: [],
    risks: [],
    decisions: [],
    outputs: [],
    successCriteria: [],
    resources: [],
    deadline: null,
    criticalPath: [],
    contextEvidence: [],
    workspaceId: 'workspace-1',
    createdAt: new Date().toISOString(),
    validationIssues: [],
    revisionOf: null,
    revisionReason: null,
    budgetExhausted: false,
    generationFailed: false,
    declineReason: null,
    ...overrides,
  }
}

describe('planToProvenance', () => {
  it('returns an empty chain when the plan had no real context evidence, rather than fabricating one', () => {
    const chain = planToProvenance(basePlan())
    expect(chain).toEqual({ evidence: [], derivations: [] })
  })

  it('maps real context evidence to EvidenceReferences, preserving the verbatim excerpt', () => {
    const plan = basePlan({ contextEvidence: [{ id: 'chunk-1', type: 'document', title: 'Pricing Doc', excerpt: 'Our pricing is outdated.' }] })
    const chain = planToProvenance(plan)
    expect(chain.evidence).toEqual([{ id: 'chunk-1', source: { type: 'document', title: 'Pricing Doc', id: 'chunk-1' }, location: { kind: 'whole' }, excerpt: 'Our pricing is outdated.', retrievedAt: null }])
  })

  it('produces one synthesis derivation citing every context evidence id when evidence exists', () => {
    const plan = basePlan({
      contextEvidence: [
        { id: 'chunk-1', type: 'document', title: 'Doc A', excerpt: 'Excerpt A' },
        { id: 'note-1', type: 'note', title: 'Note B', excerpt: 'Excerpt B' },
      ],
    })
    const chain = planToProvenance(plan)
    expect(chain.derivations).toHaveLength(1)
    expect(chain.derivations[0]!.kind).toBe('synthesis')
    expect(chain.derivations[0]!.evidenceIds.sort()).toEqual(['chunk-1', 'note-1'])
    expect(chain.derivations[0]!.basedOnDerivationIds).toEqual([])
    expect(chain.derivations[0]!.statement).toBe('The gap.')
  })

  it('does not produce a derivation for a declined or failed plan even if context evidence happens to be present', () => {
    const plan = basePlan({ status: 'declined', declineReason: 'Too vague.', contextEvidence: [{ id: 'chunk-1', type: 'document', title: 'Doc A', excerpt: 'Excerpt A' }] })
    const chain = planToProvenance(plan)
    expect(chain.derivations).toEqual([])
    // The evidence itself is still real and reportable — only the synthesis derivation is withheld.
    expect(chain.evidence).toHaveLength(1)
  })

  it('maps asset-sourced context evidence to the shared asset SourceType', () => {
    const plan = basePlan({ contextEvidence: [{ id: 'asset-1', type: 'asset', title: 'Whiteboard photo', excerpt: 'Sketched roadmap.' }] })
    const chain = planToProvenance(plan)
    expect(chain.evidence[0]!.source.type).toBe('asset')
  })

  describe('I6 — decision point delegation splices in the real Decision Intelligence provenance chain', () => {
    function delegatedDecision(): Decision {
      return {
        id: 'decision-1',
        title: 'Which tier to feature',
        question: 'Which pricing tiers to feature',
        objective: 'Do the thing',
        status: 'complete',
        alternatives: [{ id: 'alt-1', title: 'Top tier only', description: '', advantages: [], disadvantages: [], estimatedImpact: null, risks: [], evidenceIds: ['src-1'] }],
        criteria: [{ id: 'c1', name: 'Simplicity', description: '', weight: 1, importance: 'high', evaluationMethod: null }],
        evaluations: [{ alternativeId: 'alt-1', criterionId: 'c1', score: 8, rationale: 'simpler launch', evidenceIds: ['src-1'], confidence: 'medium' }],
        weightedScores: [{ alternativeId: 'alt-1', totalScore: 8, breakdown: [{ criterionId: 'c1', normalizedWeight: 1, score: 8, contribution: 8 }], missingCriterionIds: [] }],
        recommendedAlternativeId: 'alt-1',
        confidence: 'medium',
        rationale: 'A single tier keeps the launch page simple.',
        tradeoffs: [],
        risks: [],
        assumptions: [],
        constraints: [],
        unknowns: [],
        consequences: [],
        sensitivity: [],
        nextAction: null,
        contextEvidence: [{ id: 'src-1', type: 'document', title: 'Pricing Doc', excerpt: 'Simpler pages convert better.' }],
        datasetInvestigation: null,
        provisional: false,
        provisionalReason: null,
        validationIssues: [],
        budgetExhausted: false,
        generationFailed: false,
        declineReason: null,
        workspaceId: 'workspace-1',
        createdAt: new Date().toISOString(),
      }
    }

    function baseDecisionPoint(overrides: Partial<PlanDecision> = {}): PlanDecision {
      return { id: 'pd-1', decision: 'Which pricing tiers to feature', options: [], recommendation: null, unresolved: true, decisionIntelligence: null, ...overrides }
    }

    it('splices the delegated Decision\'s own evidence and derivations into the plan\'s chain', () => {
      const plan = basePlan({ decisions: [baseDecisionPoint({ decisionIntelligence: delegatedDecision() })] })
      const chain = planToProvenance(plan)

      expect(chain.evidence).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'src-1' })]))
      expect(chain.derivations.some((d) => d.id === 'decision:decision-1:synthesis' && d.statement === 'A single tier keeps the launch page simple.')).toBe(true)
      expect(chain.derivations.some((d) => d.kind === 'observation' && d.evidenceIds.includes('src-1'))).toBe(true)
    })

    it('links the plan-level synthesis derivation back to the nested decision synthesis', () => {
      const plan = basePlan({ decisions: [baseDecisionPoint({ decisionIntelligence: delegatedDecision() })] })
      const chain = planToProvenance(plan)

      const planSynthesis = chain.derivations.find((d) => d.id === `planning:${plan.id}:synthesis`)
      expect(planSynthesis).toBeDefined()
      expect(planSynthesis!.basedOnDerivationIds).toContain('decision:decision-1:synthesis')
    })

    it('produces no nested provenance for a decision point that was never delegated (decisionIntelligence: null)', () => {
      const plan = basePlan({ decisions: [baseDecisionPoint()] })
      const chain = planToProvenance(plan)
      expect(chain).toEqual({ evidence: [], derivations: [] })
    })
  })
})
