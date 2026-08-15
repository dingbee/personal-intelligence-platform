import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { Action, ActionSet } from '@/modules/action-intelligence/action'

const { createIntelligenceRecordMock } = vi.hoisted(() => ({
  createIntelligenceRecordMock: vi.fn(),
}))

vi.mock('@/modules/intelligence-ledger/api/createIntelligenceRecord', () => ({ createIntelligenceRecord: createIntelligenceRecordMock }))

import { recordActionIntelligenceRecord } from '@/modules/intelligence-ledger/api/recordActionIntelligenceRecord'

function realAction(overrides: Partial<Action> = {}): Action {
  return {
    id: 'action-1',
    title: 'Email the pilot customers about the new tier',
    description: 'Reach out per the Q3 usage findings',
    type: 'action',
    status: 'proposed',
    priority: 'high',
    sequence: 0,
    readiness: { state: 'ready', blockers: [], missingInformation: [] },
    dependencies: [],
    actor: { type: 'user', label: null },
    source: { kind: 'decision', label: 'Should we switch to usage-based pricing?' },
    expectedOutput: { outcome: 'Pilot customers are informed', completionCriteria: null },
    dueHint: null,
    evidenceIds: ['evidence-1'],
    ...overrides,
  }
}

function realActionSet(overrides: Partial<ActionSet> = {}): ActionSet {
  return {
    id: 'action-set-1',
    title: 'Actions for the pricing decision',
    objective: 'Grow revenue without hurting retention',
    status: 'complete',
    actions: [realAction()],
    contextEvidence: [{ id: 'evidence-1', type: 'document', title: 'Q3 usage report', excerpt: 'Usage grew 22% quarter over quarter.' }],
    validationIssues: [],
    budgetExhausted: false,
    generationFailed: false,
    declineReason: null,
    workspaceId: 'workspace-1',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('recordActionIntelligenceRecord', () => {
  beforeEach(() => createIntelligenceRecordMock.mockReset())

  it('persists a real ActionSet through the actual actionIntelligenceAdapter', async () => {
    createIntelligenceRecordMock.mockResolvedValueOnce({ id: 'record-1' })

    await recordActionIntelligenceRecord({ actionSet: realActionSet(), workspaceId: 'workspace-1', operationId: 'operation-1', providerId: 'anthropic' })

    expect(createIntelligenceRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace-1',
        recordType: 'action',
        summary: 'Action set: Actions for the pricing decision',
        operationId: 'operation-1',
        providerId: 'anthropic',
      }),
    )

    const call = createIntelligenceRecordMock.mock.calls[0]![0]
    expect(call.provenance.evidence).toHaveLength(1)
    expect(call.provenance.derivations).toEqual([
      { id: 'action:action-1', kind: 'interpretation', evidenceIds: ['evidence-1'], basedOnDerivationIds: [], statement: 'Email the pilot customers about the new tier: Reach out per the Q3 usage findings', method: null },
    ])
  })

  it('never sets a parentRecordId, even though this action set was decision-derived — no real upstream Ledger record id exists to cite', async () => {
    createIntelligenceRecordMock.mockResolvedValueOnce({ id: 'record-1' })

    await recordActionIntelligenceRecord({ actionSet: realActionSet(), workspaceId: 'workspace-1', operationId: 'operation-1', providerId: 'anthropic' })

    expect(createIntelligenceRecordMock.mock.calls[0]![0].parentRecordId).toBeUndefined()
  })

  it('an action with no cited evidence contributes no derivation — never grounded in nothing', async () => {
    createIntelligenceRecordMock.mockResolvedValueOnce({ id: 'record-1' })
    const actionSet = realActionSet({ actions: [realAction({ evidenceIds: [] })] })

    await recordActionIntelligenceRecord({ actionSet, workspaceId: 'workspace-1', operationId: 'operation-1', providerId: 'anthropic' })

    expect(createIntelligenceRecordMock.mock.calls[0]![0].provenance.derivations).toEqual([])
  })
})
