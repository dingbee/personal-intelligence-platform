import { describe, expect, it } from 'vitest'
import { buildExecutionContract } from '@/modules/execution-foundation/api/buildExecutionContract'
import type { Action } from '@/modules/action-intelligence/action'

function mkAction(overrides: Partial<Action> = {}): Action {
  return {
    id: 'action-1',
    title: 'Draft outreach email',
    description: 'Write the outreach email for the beta cohort.',
    type: 'action',
    status: 'proposed',
    priority: 'medium',
    sequence: 1,
    readiness: { state: 'ready', blockers: [], missingInformation: [] },
    dependencies: [],
    actor: { type: 'user', label: 'me' },
    source: { kind: 'user_instruction', label: 'Ship the beta' },
    expectedOutput: { outcome: 'Draft ready for review', completionCriteria: null },
    dueHint: null,
    evidenceIds: [],
    ...overrides,
  }
}

describe('buildExecutionContract', () => {
  it('builds a low-risk, no-external-side-effects contract for save_action_to_notes', () => {
    const draft = buildExecutionContract({ action: mkAction(), capability: 'save_action_to_notes' })
    expect(draft.contract.riskClassification).toBe('low')
    expect(draft.contract.externalSideEffects).toBe(false)
    expect(draft.contract.inputPayload).toEqual({ actionId: 'action-1' })
    expect(draft.contract.expectedEffect).toContain('Draft outreach email')
  })

  it('builds a contract for add_action_as_workspace_objective', () => {
    const draft = buildExecutionContract({ action: mkAction(), capability: 'add_action_as_workspace_objective' })
    expect(draft.contract.capability).toBe('add_action_as_workspace_objective')
    expect(draft.contract.target).toEqual({})
  })

  it('builds a contract for link_action_to_workspace_objective with the real target objective id', () => {
    const draft = buildExecutionContract({ action: mkAction(), capability: 'link_action_to_workspace_objective', targetObjectiveId: 'obj-1' })
    expect(draft.contract.target).toEqual({ objectiveId: 'obj-1' })
  })

  it('throws rather than silently proceeding when link_action_to_workspace_objective has no targetObjectiveId', () => {
    expect(() => buildExecutionContract({ action: mkAction(), capability: 'link_action_to_workspace_objective' })).toThrow()
  })

  it('carries real, honest source provenance from the action, never fabricated', () => {
    const draft = buildExecutionContract({ action: mkAction({ source: { kind: 'decision', label: 'Which launch strategy?' } }), capability: 'save_action_to_notes' })
    expect(draft.source).toEqual({ kind: 'action', actionId: 'action-1', actionSource: { kind: 'decision', label: 'Which launch strategy?', planId: null, decisionId: null } })
  })

  it('freezes the full action as the actionSnapshot', () => {
    const action = mkAction()
    const draft = buildExecutionContract({ action, capability: 'save_action_to_notes' })
    expect(draft.actionSnapshot).toEqual(action)
  })
})
