import { describe, expect, it } from 'vitest'
import { describeExecutionProvenance } from '@/shared/provenance/adapters/executionAdapter'
import type { ExecutionAttempt, ExecutionAuthorization, ExecutionRequest } from '@/modules/execution-foundation/execution'

function baseRequest(overrides: Partial<ExecutionRequest> = {}): ExecutionRequest {
  return {
    id: 'req-1',
    userId: 'user-1',
    workspaceId: 'workspace-1',
    status: 'succeeded',
    actionSnapshot: { id: 'action-1', title: 'Draft outreach email', evidenceIds: ['src-1', 'src-2'] },
    source: { kind: 'action', actionId: 'action-1', actionSource: { kind: 'user_instruction', label: 'Ship the beta' } },
    capability: 'save_action_to_notes',
    target: {},
    inputPayload: { actionId: 'action-1' },
    expectedEffect: 'A note is created',
    riskClassification: 'low',
    externalSideEffects: false,
    idempotencyKey: 'hash-1',
    contractHash: 'hash-1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:05:00Z',
    expiresAt: '2026-01-02T00:00:00Z',
    ...overrides,
  }
}

describe('describeExecutionProvenance', () => {
  it('answers "why was this created" and "which action produced it" from the request source, honestly (never fabricated)', () => {
    const provenance = describeExecutionProvenance(baseRequest(), [], [])
    expect(provenance.source).toEqual({ kind: 'action', actionId: 'action-1', actionSource: { kind: 'user_instruction', label: 'Ship the beta' } })
  })

  it('extracts the real, unresolved evidence ids from the action snapshot rather than fabricating source details', () => {
    const provenance = describeExecutionProvenance(baseRequest(), [], [])
    expect(provenance.actionEvidenceIds).toEqual(['src-1', 'src-2'])
  })

  it('returns an empty evidence id list honestly when the action snapshot is missing', () => {
    const provenance = describeExecutionProvenance(baseRequest({ actionSnapshot: null }), [], [])
    expect(provenance.actionEvidenceIds).toEqual([])
  })

  it('answers "who authorized it" and "what exactly was authorized" from the most recent authorization', () => {
    const authorization: ExecutionAuthorization = {
      id: 'auth-1',
      executionRequestId: 'req-1',
      approvingUserId: 'user-1',
      decision: 'approved',
      capability: 'save_action_to_notes',
      target: {},
      scope: {},
      contractHashAtApproval: 'hash-1',
      expiresAt: null,
      createdAt: '2026-01-01T00:01:00Z',
    }
    const provenance = describeExecutionProvenance(baseRequest(), [authorization], [])
    expect(provenance.authorization).toEqual({ approvingUserId: 'user-1', decision: 'approved', capability: 'save_action_to_notes', target: {}, scope: {}, grantedAt: '2026-01-01T00:01:00Z' })
  })

  it('picks the most recent authorization when more than one exists', () => {
    const older: ExecutionAuthorization = { id: 'auth-1', executionRequestId: 'req-1', approvingUserId: 'user-1', decision: 'rejected', capability: 'x', target: {}, scope: {}, contractHashAtApproval: 'h', expiresAt: null, createdAt: '2026-01-01T00:00:00Z' }
    const newer: ExecutionAuthorization = { id: 'auth-2', executionRequestId: 'req-1', approvingUserId: 'user-1', decision: 'approved', capability: 'x', target: {}, scope: {}, contractHashAtApproval: 'h', expiresAt: null, createdAt: '2026-01-01T00:02:00Z' }
    const provenance = describeExecutionProvenance(baseRequest(), [older, newer], [])
    expect(provenance.authorization?.decision).toBe('approved')
  })

  it('returns null authorization honestly when none has been recorded yet', () => {
    const provenance = describeExecutionProvenance(baseRequest(), [], [])
    expect(provenance.authorization).toBeNull()
  })

  it('answers "what actually happened" from every attempt, in order', () => {
    const attempts: ExecutionAttempt[] = [
      { id: 'a1', executionRequestId: 'req-1', attemptNumber: 1, startedAt: 't1', completedAt: 't1', outcome: 'failed', failureKind: 'transient', failureMessage: 'timed out', result: null },
      { id: 'a2', executionRequestId: 'req-1', attemptNumber: 2, startedAt: 't2', completedAt: 't2', outcome: 'succeeded', failureKind: null, failureMessage: null, result: { noteId: 'note-1' } },
    ]
    const provenance = describeExecutionProvenance(baseRequest(), [], attempts)
    expect(provenance.attempts).toEqual([
      { attemptNumber: 1, outcome: 'failed', failureKind: 'transient', completedAt: 't1' },
      { attemptNumber: 2, outcome: 'succeeded', failureKind: null, completedAt: 't2' },
    ])
  })

  it('answers "what was the result" from the successful attempt, never fabricating one when nothing succeeded', () => {
    const failedOnly: ExecutionAttempt[] = [{ id: 'a1', executionRequestId: 'req-1', attemptNumber: 1, startedAt: 't1', completedAt: 't1', outcome: 'failed', failureKind: 'permanent', failureMessage: 'x', result: null }]
    expect(describeExecutionProvenance(baseRequest(), [], failedOnly).result).toBeNull()

    const succeeded: ExecutionAttempt[] = [{ id: 'a1', executionRequestId: 'req-1', attemptNumber: 1, startedAt: 't1', completedAt: 't1', outcome: 'succeeded', failureKind: null, failureMessage: null, result: { noteId: 'note-1' } }]
    expect(describeExecutionProvenance(baseRequest(), [], succeeded).result).toEqual({ noteId: 'note-1' })
  })
})
