import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ExecutionAttempt, ExecutionAuthorization, ExecutionRequest } from '@/modules/execution-foundation/execution'

const { createIntelligenceRecordMock } = vi.hoisted(() => ({
  createIntelligenceRecordMock: vi.fn(),
}))

vi.mock('@/modules/intelligence-ledger/api/createIntelligenceRecord', () => ({ createIntelligenceRecord: createIntelligenceRecordMock }))

import { recordExecutionIntelligenceRecord } from '@/modules/intelligence-ledger/api/recordExecutionIntelligenceRecord'

function realRequest(overrides: Partial<ExecutionRequest> = {}): ExecutionRequest {
  return {
    id: 'exec-1',
    userId: 'user-1',
    workspaceId: 'workspace-1',
    status: 'succeeded',
    capability: 'save_action_to_notes',
    target: {},
    inputPayload: {},
    expectedEffect: 'A note is created summarizing the action',
    riskClassification: 'low',
    externalSideEffects: false,
    actionSnapshot: { evidenceIds: ['evidence-1'] },
    source: { kind: 'action', actionId: 'action-1', actionSource: { kind: 'decision', label: 'pricing decision' } },
    idempotencyKey: 'idem-1',
    contractHash: 'hash-1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:05:00Z',
    expiresAt: '2026-01-02T00:00:00Z',
    ...overrides,
  }
}

function realAuthorization(overrides: Partial<ExecutionAuthorization> = {}): ExecutionAuthorization {
  return {
    id: 'auth-1',
    executionRequestId: 'exec-1',
    approvingUserId: 'user-1',
    decision: 'approved',
    capability: 'save_action_to_notes',
    target: {},
    scope: {},
    contractHashAtApproval: 'hash-1',
    expiresAt: null,
    createdAt: '2026-01-01T00:01:00Z',
    ...overrides,
  }
}

function realAttempt(overrides: Partial<ExecutionAttempt> = {}): ExecutionAttempt {
  return {
    id: 'attempt-1',
    executionRequestId: 'exec-1',
    attemptNumber: 1,
    startedAt: '2026-01-01T00:02:00Z',
    completedAt: '2026-01-01T00:03:00Z',
    outcome: 'succeeded',
    failureKind: null,
    failureMessage: null,
    result: { noteId: 'note-1' },
    ...overrides,
  }
}

describe('recordExecutionIntelligenceRecord', () => {
  beforeEach(() => createIntelligenceRecordMock.mockReset())

  it('persists a real ExecutionRequest through the actual executionAdapter, using its own honest ExecutionProvenance shape', async () => {
    createIntelligenceRecordMock.mockResolvedValueOnce({ id: 'record-1' })

    await recordExecutionIntelligenceRecord({ request: realRequest(), authorizations: [realAuthorization()], attempts: [realAttempt()] })

    expect(createIntelligenceRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace-1',
        recordType: 'execution',
        status: 'completed',
        summary: 'Execution: save_action_to_notes (succeeded)',
        executionRequestId: 'exec-1',
      }),
    )

    const call = createIntelligenceRecordMock.mock.calls[0]![0]
    expect(call.provenance).toEqual({
      source: { kind: 'action', actionId: 'action-1', actionSource: { kind: 'decision', label: 'pricing decision' } },
      actionEvidenceIds: ['evidence-1'],
      authorization: { approvingUserId: 'user-1', decision: 'approved', capability: 'save_action_to_notes', target: {}, scope: {}, grantedAt: '2026-01-01T00:01:00Z' },
      attempts: [{ attemptNumber: 1, outcome: 'succeeded', failureKind: null, completedAt: '2026-01-01T00:03:00Z' }],
      result: { noteId: 'note-1' },
    })
  })

  it('maps a failed request to status:failed — never records a failed execution as completed', async () => {
    createIntelligenceRecordMock.mockResolvedValueOnce({ id: 'record-1' })
    const request = realRequest({ status: 'failed' })
    const attempt = realAttempt({ outcome: 'failed', failureKind: 'transient', failureMessage: 'timeout', result: null })

    await recordExecutionIntelligenceRecord({ request, authorizations: [realAuthorization()], attempts: [attempt] })

    const call = createIntelligenceRecordMock.mock.calls[0]![0]
    expect(call.status).toBe('failed')
    expect(call.provenance.result).toBeNull()
  })

  it('maps a non-terminal request status (e.g. approved/executing) to running rather than a falsely terminal state', async () => {
    createIntelligenceRecordMock.mockResolvedValueOnce({ id: 'record-1' })

    await recordExecutionIntelligenceRecord({ request: realRequest({ status: 'executing' }), authorizations: [], attempts: [] })

    expect(createIntelligenceRecordMock.mock.calls[0]![0].status).toBe('running')
  })

  it('never fabricates a parentRecordId for an execution record — actionSnapshot is a frozen copy, not a pointer to a Ledger record', async () => {
    createIntelligenceRecordMock.mockResolvedValueOnce({ id: 'record-1' })

    await recordExecutionIntelligenceRecord({ request: realRequest(), authorizations: [], attempts: [] })

    expect(createIntelligenceRecordMock.mock.calls[0]![0].parentRecordId).toBeUndefined()
  })
})
