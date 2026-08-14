import { describe, expect, it } from 'vitest'
import { planToProvenance } from '@/shared/provenance/adapters/planningIntelligenceAdapter'
import type { Plan } from '@/modules/planning-intelligence/plan'

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
    milestones: [],
    tasks: [],
    risks: [],
    decisions: [],
    outputs: [],
    successCriteria: [],
    contextEvidence: [],
    workspaceId: 'workspace-1',
    createdAt: new Date().toISOString(),
    validationIssues: [],
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
})
