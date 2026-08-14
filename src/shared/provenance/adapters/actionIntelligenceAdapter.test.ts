import { describe, expect, it } from 'vitest'
import { actionSetToProvenance, actionToProvenance } from '@/shared/provenance/adapters/actionIntelligenceAdapter'
import type { Action, ActionSet } from '@/modules/action-intelligence/action'

function mkAction(id: string, overrides: Partial<Action> = {}): Action {
  return {
    id,
    title: id,
    description: 'do the thing',
    type: 'action',
    status: 'proposed',
    priority: 'medium',
    sequence: 1,
    readiness: { state: 'ready', blockers: [], missingInformation: [] },
    dependencies: [],
    actor: { type: 'user', label: 'me' },
    source: { kind: 'user_instruction', label: 'x' },
    expectedOutput: { outcome: 'it happens', completionCriteria: null },
    dueHint: null,
    evidenceIds: [],
    ...overrides,
  }
}

function baseActionSet(overrides: Partial<ActionSet> = {}): ActionSet {
  return {
    id: 'set-1',
    title: 'An Action Set',
    objective: 'Grow',
    status: 'complete',
    actions: [],
    contextEvidence: [],
    validationIssues: [],
    budgetExhausted: false,
    generationFailed: false,
    declineReason: null,
    workspaceId: 'workspace-1',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('actionSetToProvenance', () => {
  it('returns an empty chain when there is no context evidence and no evidence-backed actions', () => {
    const chain = actionSetToProvenance(baseActionSet({ actions: [mkAction('a')] }))
    expect(chain).toEqual({ evidence: [], derivations: [] })
  })

  it('maps context evidence to EvidenceReferences, preserving the verbatim excerpt', () => {
    const actionSet = baseActionSet({ contextEvidence: [{ id: 'src-1', type: 'note', title: 'My Note', excerpt: 'Verbatim text.' }] })
    const chain = actionSetToProvenance(actionSet)
    expect(chain.evidence).toEqual([{ id: 'src-1', source: { type: 'note', title: 'My Note', id: 'src-1' }, location: { kind: 'whole' }, excerpt: 'Verbatim text.', retrievedAt: null }])
  })

  it('produces one interpretation derivation per evidence-backed action, and none for an action with no citations', () => {
    const actionSet = baseActionSet({
      contextEvidence: [{ id: 'src-1', type: 'document', title: 'Doc', excerpt: 'e' }],
      actions: [mkAction('a', { evidenceIds: ['src-1'] }), mkAction('b', { evidenceIds: [] })],
    })
    const chain = actionSetToProvenance(actionSet)
    expect(chain.derivations).toHaveLength(1)
    expect(chain.derivations[0]!.id).toBe('action:a')
    expect(chain.derivations[0]!.kind).toBe('interpretation')
    expect(chain.derivations[0]!.evidenceIds).toEqual(['src-1'])
  })

  it('never fabricates a source id — evidenceIds on the derivation always match a real contextEvidence id', () => {
    const actionSet = baseActionSet({
      contextEvidence: [{ id: 'src-1', type: 'document', title: 'Doc', excerpt: 'e' }],
      actions: [mkAction('a', { evidenceIds: ['src-1'] })],
    })
    const chain = actionSetToProvenance(actionSet)
    const realIds = new Set(chain.evidence.map((e) => e.id))
    for (const d of chain.derivations) for (const id of d.evidenceIds) expect(realIds.has(id)).toBe(true)
  })

  it('does not produce a single closing synthesis derivation — actions are siblings, not converging steps', () => {
    const actionSet = baseActionSet({
      contextEvidence: [{ id: 'src-1', type: 'document', title: 'Doc', excerpt: 'e' }],
      actions: [mkAction('a', { evidenceIds: ['src-1'] }), mkAction('b', { evidenceIds: ['src-1'] })],
    })
    const chain = actionSetToProvenance(actionSet)
    expect(chain.derivations.some((d) => d.kind === 'synthesis')).toBe(false)
    expect(chain.derivations).toHaveLength(2)
  })
})

describe('actionToProvenance', () => {
  it('returns just the one action\'s own evidence-backed derivation, filtered to sources it actually cites', () => {
    const action = mkAction('a', { evidenceIds: ['src-1'] })
    const sources = [
      { id: 'src-1', type: 'document' as const, title: 'Relevant', excerpt: 'e1' },
      { id: 'src-2', type: 'note' as const, title: 'Unrelated', excerpt: 'e2' },
    ]
    const chain = actionToProvenance(action, sources)
    expect(chain.evidence).toHaveLength(1)
    expect(chain.evidence[0]!.id).toBe('src-1')
    expect(chain.derivations).toHaveLength(1)
  })

  it('handles an action with no evidence honestly (empty chain, not a fabricated citation)', () => {
    const action = mkAction('a', { evidenceIds: [] })
    const chain = actionToProvenance(action, [{ id: 'src-1', type: 'document', title: 'Doc', excerpt: 'e' }])
    expect(chain).toEqual({ evidence: [], derivations: [] })
  })
})
