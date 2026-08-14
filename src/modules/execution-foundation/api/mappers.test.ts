import { describe, expect, it } from 'vitest'
import { toExecutionAttempt, toExecutionAuditEvent, toExecutionAuthorization, toExecutionRequest } from '@/modules/execution-foundation/api/mappers'

describe('toExecutionRequest', () => {
  it('maps every snake_case DB column to its camelCase domain field', () => {
    const row = {
      id: 'req-1',
      user_id: 'user-1',
      workspace_id: 'ws-1',
      status: 'approved' as const,
      action_snapshot: { title: 'Do the thing' },
      source: { kind: 'manual', label: 'Manual' },
      capability: 'save_action_to_notes',
      target: { objectiveId: 'obj-1' },
      input_payload: { actionId: 'action-1' },
      expected_effect: 'Saves the action to a note.',
      risk_classification: 'low' as const,
      external_side_effects: false,
      idempotency_key: 'hash-1',
      contract_hash: 'hash-1',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      expires_at: '2026-01-02T00:00:00Z',
    }

    expect(toExecutionRequest(row)).toEqual({
      id: 'req-1',
      userId: 'user-1',
      workspaceId: 'ws-1',
      status: 'approved',
      actionSnapshot: { title: 'Do the thing' },
      source: { kind: 'manual', label: 'Manual' },
      capability: 'save_action_to_notes',
      target: { objectiveId: 'obj-1' },
      inputPayload: { actionId: 'action-1' },
      expectedEffect: 'Saves the action to a note.',
      riskClassification: 'low',
      externalSideEffects: false,
      idempotencyKey: 'hash-1',
      contractHash: 'hash-1',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      expiresAt: '2026-01-02T00:00:00Z',
    })
  })
})

describe('toExecutionAuthorization', () => {
  it('maps every field, preserving a null expiresAt rather than inventing one', () => {
    const row = {
      id: 'auth-1',
      execution_request_id: 'req-1',
      approving_user_id: 'user-1',
      decision: 'rejected' as const,
      capability: 'save_action_to_notes',
      target: {},
      scope: {},
      contract_hash_at_approval: 'hash-1',
      expires_at: null,
      created_at: '2026-01-01T00:00:00Z',
    }

    expect(toExecutionAuthorization(row)).toEqual({
      id: 'auth-1',
      executionRequestId: 'req-1',
      approvingUserId: 'user-1',
      decision: 'rejected',
      capability: 'save_action_to_notes',
      target: {},
      scope: {},
      contractHashAtApproval: 'hash-1',
      expiresAt: null,
      createdAt: '2026-01-01T00:00:00Z',
    })
  })
})

describe('toExecutionAttempt', () => {
  it('maps a failed attempt, preserving failureKind/failureMessage', () => {
    const row = {
      id: 'attempt-1',
      execution_request_id: 'req-1',
      attempt_number: 2,
      started_at: '2026-01-01T00:00:00Z',
      completed_at: '2026-01-01T00:00:05Z',
      outcome: 'failed' as const,
      failure_kind: 'transient' as const,
      failure_message: 'Network blip',
      result: null,
    }

    expect(toExecutionAttempt(row)).toEqual({
      id: 'attempt-1',
      executionRequestId: 'req-1',
      attemptNumber: 2,
      startedAt: '2026-01-01T00:00:00Z',
      completedAt: '2026-01-01T00:00:05Z',
      outcome: 'failed',
      failureKind: 'transient',
      failureMessage: 'Network blip',
      result: null,
    })
  })
})

describe('toExecutionAuditEvent', () => {
  it('maps an audit event, preserving a null actorUserId for system-driven events', () => {
    const row = {
      id: 'event-1',
      execution_request_id: 'req-1',
      event_type: 'execution_expired',
      actor_user_id: null,
      metadata: {},
      created_at: '2026-01-01T00:00:00Z',
    }

    expect(toExecutionAuditEvent(row)).toEqual({
      id: 'event-1',
      executionRequestId: 'req-1',
      eventType: 'execution_expired',
      actorUserId: null,
      metadata: {},
      createdAt: '2026-01-01T00:00:00Z',
    })
  })
})
