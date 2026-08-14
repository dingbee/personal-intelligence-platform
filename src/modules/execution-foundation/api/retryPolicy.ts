import type { ExecutionFailureKind } from '@/modules/execution-foundation/execution'

/**
 * Deterministic, bounded retry policy — sprint brief Phase 8's own
 * explicit requirement: "Do NOT let an LLM decide whether an operation
 * should retry. Retry policy must be deterministic." No model is
 * consulted anywhere in this file; the decision is a pure function of
 * the failure kind and how many attempts have already been made.
 *
 * Only 'transient' and 'timeout' failures are retryable — every other
 * kind (validation/authorization/capability_unavailable/dependency/
 * permanent/external_rejection/unknown) describes a condition retrying
 * cannot fix, so retrying it would just consume attempts for a
 * guaranteed-identical outcome.
 */
export const MAX_EXECUTION_ATTEMPTS = 3

const RETRYABLE_FAILURE_KINDS: ReadonlySet<ExecutionFailureKind> = new Set(['transient', 'timeout'])

export interface RetryDecision {
  shouldRetry: boolean
  /** True when this attempt's outcome is terminal for the whole execution request (the RPC uses this to decide whether to flip status to 'failed' or leave it 'executing' for the next attempt). */
  isFinal: boolean
}

export function isRetryableFailureKind(failureKind: ExecutionFailureKind): boolean {
  return RETRYABLE_FAILURE_KINDS.has(failureKind)
}

/** `attemptNumber` is the attempt that just failed (1-based) — a retry is only offered while it is strictly below the bound and the failure kind is itself retryable. */
export function decideRetry(failureKind: ExecutionFailureKind, attemptNumber: number): RetryDecision {
  const shouldRetry = isRetryableFailureKind(failureKind) && attemptNumber < MAX_EXECUTION_ATTEMPTS
  return { shouldRetry, isFinal: !shouldRetry }
}
