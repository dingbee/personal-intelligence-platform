import type { ExecutionRequestStatus } from '@/modules/execution-foundation/execution'

/**
 * The deterministic execution state machine — a pure, client-testable
 * mirror of what the SECURITY DEFINER RPCs in
 * supabase/migrations/0065_execution_foundation.sql already enforce
 * server-side (the actual authority; this module exists so the UI can
 * disable an invalid action before round-tripping to the server, and so
 * the transition table itself is unit-testable). Every entry here must
 * stay in lockstep with the RPCs' own `if v_request.status not in (...)`
 * checks — see each function's own reference to which RPC it mirrors.
 */
const TRANSITIONS: Record<ExecutionRequestStatus, ExecutionRequestStatus[]> = {
  proposed: ['approved', 'rejected', 'cancelled', 'expired'],
  awaiting_approval: ['approved', 'rejected', 'cancelled', 'expired'],
  approved: ['executing', 'cancelled', 'expired'],
  rejected: [],
  executing: ['executing', 'succeeded', 'failed', 'cancelled'],
  succeeded: [],
  failed: [],
  cancelled: [],
  expired: [],
}

export const TERMINAL_STATUSES: ReadonlySet<ExecutionRequestStatus> = new Set(['rejected', 'succeeded', 'failed', 'cancelled', 'expired'])

export function isTerminalStatus(status: ExecutionRequestStatus): boolean {
  return TERMINAL_STATUSES.has(status)
}

/** Mirrors authorize_execution_request()'s own `status not in ('proposed', 'awaiting_approval')` check. */
export function canAuthorize(status: ExecutionRequestStatus): boolean {
  return isValidTransition(status, 'approved')
}

/**
 * Mirrors start_execution()'s own `status <> 'approved'` check — deliberately
 * NOT `isValidTransition(status, 'executing')`, since TRANSITIONS.executing
 * includes a self-loop ('executing' -> 'executing') to describe the
 * multi-attempt retry loop staying in 'executing' between attempts, which
 * would otherwise make canStart('executing') true and let the UI offer
 * "Run" on an execution the RPC would reject as not 'approved'.
 */
export function canStart(status: ExecutionRequestStatus): boolean {
  return status === 'approved'
}

/** Mirrors cancel_execution()'s own allowed-status list. */
export function canCancel(status: ExecutionRequestStatus): boolean {
  return isValidTransition(status, 'cancelled')
}

/** Mirrors expire_execution()'s own allowed-status list (the TTL check itself is a separate, server-verified concern — see isExpired.ts). */
export function canExpire(status: ExecutionRequestStatus): boolean {
  return isValidTransition(status, 'expired')
}

export function isValidTransition(from: ExecutionRequestStatus, to: ExecutionRequestStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

export function getValidNextStatuses(from: ExecutionRequestStatus): ExecutionRequestStatus[] {
  return TRANSITIONS[from]
}
