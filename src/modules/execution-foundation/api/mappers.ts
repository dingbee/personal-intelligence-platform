import type { ExecutionAttemptRow, ExecutionAuditEventRow, ExecutionAuthorizationRow, ExecutionRequestRow } from '@/shared/types/database'
import type { ExecutionAttempt, ExecutionAuditEvent, ExecutionAuditEventType, ExecutionAuthorization, ExecutionRequest, ExecutionSource } from '@/modules/execution-foundation/execution'

/** DB row (snake_case) -> domain type (camelCase). One direction only — this module never writes a row back, every mutation goes through an RPC that returns its own already-camelCase-mappable row. */
export function toExecutionRequest(row: ExecutionRequestRow): ExecutionRequest {
  return {
    id: row.id,
    userId: row.user_id,
    workspaceId: row.workspace_id,
    status: row.status,
    actionSnapshot: row.action_snapshot,
    source: row.source as unknown as ExecutionSource,
    capability: row.capability,
    target: row.target,
    inputPayload: row.input_payload,
    expectedEffect: row.expected_effect,
    riskClassification: row.risk_classification,
    externalSideEffects: row.external_side_effects,
    idempotencyKey: row.idempotency_key,
    contractHash: row.contract_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at,
  }
}

export function toExecutionAuthorization(row: ExecutionAuthorizationRow): ExecutionAuthorization {
  return {
    id: row.id,
    executionRequestId: row.execution_request_id,
    approvingUserId: row.approving_user_id,
    decision: row.decision,
    capability: row.capability,
    target: row.target,
    scope: row.scope,
    contractHashAtApproval: row.contract_hash_at_approval,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }
}

export function toExecutionAttempt(row: ExecutionAttemptRow): ExecutionAttempt {
  return {
    id: row.id,
    executionRequestId: row.execution_request_id,
    attemptNumber: row.attempt_number,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    outcome: row.outcome,
    failureKind: row.failure_kind,
    failureMessage: row.failure_message,
    result: row.result,
  }
}

export function toExecutionAuditEvent(row: ExecutionAuditEventRow): ExecutionAuditEvent {
  return {
    id: row.id,
    executionRequestId: row.execution_request_id,
    eventType: row.event_type as ExecutionAuditEventType,
    actorUserId: row.actor_user_id,
    metadata: row.metadata,
    createdAt: row.created_at,
  }
}
