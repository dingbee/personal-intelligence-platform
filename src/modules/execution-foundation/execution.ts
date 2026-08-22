/**
 * ARRIYIA — Execution Foundation.
 *
 * The controlled boundary that follows Action Intelligence:
 *
 *   ACTION -> EXECUTION REQUEST -> AUTHORIZATION -> EXECUTION CONTRACT
 *     -> CONTROLLED EXECUTOR -> RESULT -> AUDIT / PROVENANCE
 *
 * This is explicitly NOT autonomous execution — see runExecutionAttempt.ts's
 * own doc comment for the trust boundary this module exists to enforce.
 * The three facts this whole module is built to keep separate, never
 * collapsed into one another:
 *
 *   - An action being READY (action-intelligence's own
 *     computeActionReadiness) does not mean it is authorized to execute.
 *   - An action being RECOMMENDED does not mean it should execute.
 *   - An approved execution request does not imply permission to access
 *     every external capability — only the one capability it explicitly
 *     named (see capabilityRegistry.ts).
 *
 * Every status transition below is enforced server-side by a SECURITY
 * DEFINER Postgres RPC (supabase/migrations/0065_execution_foundation.sql)
 * — this file's types describe what those RPCs already guarantee, not an
 * independent client-side notion of "valid" that a client could
 * disagree with the server about.
 */

export type ExecutionRequestStatus = 'proposed' | 'awaiting_approval' | 'approved' | 'rejected' | 'executing' | 'succeeded' | 'failed' | 'cancelled' | 'expired'

export type ExecutionRiskClassification = 'low' | 'medium' | 'high'

export type ExecutionFailureKind = 'validation' | 'authorization' | 'capability_unavailable' | 'dependency' | 'timeout' | 'transient' | 'permanent' | 'external_rejection' | 'unknown'

/**
 * What produced this execution request — honest provenance, never
 * fabricated. An action-derived request carries the real Action
 * Intelligence action id and its own upstream source (plan/decision/
 * instruction/evidence, see action-intelligence's own ActionSource);
 * a manual request (created directly from the UI, not from a generated
 * Action) says so rather than inventing an action id. `planId`/
 * `decisionId` (I7 addition) carry the real upstream Plan.id/Decision.id
 * straight through from Action.source, never re-derived or fabricated —
 * see action.ts's own ActionSource doc comment.
 */
export type ExecutionSource =
  | { kind: 'action'; actionId: string; actionSource: { kind: string; label: string; planId?: string | null; decisionId?: string | null } }
  | { kind: 'manual'; label: string }

/**
 * The material, hashable subset of an execution request — everything
 * that defines WHAT would happen. See contractHash.ts. Deliberately
 * excludes mutable/lifecycle fields (id, status, timestamps) — those
 * describe the request's own history, not the contract itself.
 */
export interface ExecutionContract {
  capability: string
  target: Record<string, unknown>
  inputPayload: Record<string, unknown>
  expectedEffect: string
  riskClassification: ExecutionRiskClassification
  externalSideEffects: boolean
}

/**
 * A proposed or in-flight execution. `actionSnapshot` freezes the
 * originating Action Intelligence Action (when this request is
 * action-derived) at request-creation time — never re-read live, so an
 * already-granted authorization can never be silently reinterpreted
 * against a since-changed action.
 */
export interface ExecutionRequest extends ExecutionContract {
  id: string
  userId: string
  workspaceId: string | null
  status: ExecutionRequestStatus
  actionSnapshot: Record<string, unknown> | null
  source: ExecutionSource
  idempotencyKey: string
  contractHash: string
  createdAt: string
  updatedAt: string
  expiresAt: string
}

export type ExecutionAuthorizationDecision = 'approved' | 'rejected'

/** Never a bare `approved: true` — always who, when, what was approved, and against which exact contract hash. */
export interface ExecutionAuthorization {
  id: string
  executionRequestId: string
  approvingUserId: string
  decision: ExecutionAuthorizationDecision
  capability: string
  target: Record<string, unknown>
  scope: Record<string, unknown>
  contractHashAtApproval: string
  expiresAt: string | null
  createdAt: string
}

export interface ExecutionResult {
  outcome: 'succeeded'
  result: Record<string, unknown> | null
}

export interface ExecutionFailure {
  outcome: 'failed'
  failureKind: ExecutionFailureKind
  message: string
}

/** The outcome of one attempt — discriminated on `outcome`, never an ambiguous boolean. */
export type ExecutionOutcome = ExecutionResult | ExecutionFailure

export interface ExecutionAttempt {
  id: string
  executionRequestId: string
  attemptNumber: number
  startedAt: string
  completedAt: string | null
  outcome: 'succeeded' | 'failed' | null
  failureKind: ExecutionFailureKind | null
  failureMessage: string | null
  result: Record<string, unknown> | null
}

export type ExecutionAuditEventType =
  | 'execution_requested'
  | 'authorization_requested'
  | 'authorization_granted'
  | 'authorization_rejected'
  | 'execution_started'
  | 'attempt_succeeded'
  | 'attempt_failed'
  | 'execution_completed'
  | 'execution_failed'
  | 'execution_cancelled'
  | 'execution_expired'

export interface ExecutionAuditEvent {
  id: string
  executionRequestId: string
  eventType: ExecutionAuditEventType
  actorUserId: string | null
  metadata: Record<string, unknown>
  createdAt: string
}
