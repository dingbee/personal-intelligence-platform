import { describeExecutionProvenance } from '@/shared/provenance/adapters/executionAdapter'
import { writeIntelligenceRecord } from '@/modules/intelligence-ledger/api/writeIntelligenceRecord'
import { writeIntelligenceOutcome } from '@/modules/learning-intelligence/api/writeIntelligenceOutcome'
import { deriveExecutionPatternKey } from '@/modules/learning-intelligence/api/recordIntelligenceOutcome'
import type { ExecutionAttempt, ExecutionAuthorization, ExecutionRequest } from '@/modules/execution-foundation/execution'
import type { IntelligenceRecordStatus, OutcomeComparisonResult } from '@/shared/types/database'

/**
 * I8.18's own action-outcome-learning integration point: "Action ->
 * execution -> verification -> outcome -> learning signal. Do not learn
 * from unverified execution claims." Reuses I7's own already-computed
 * verifyOutcome.ts result (folded into the final attempt's own `result`
 * jsonb by executeCapability.ts) — never re-implements verification.
 *
 * Deliberately returns null (no learning signal touched) for anything
 * that isn't a genuinely terminal succeeded/failed request — an
 * 'executing' mid-retry state has no real outcome yet to learn from.
 */
function deriveExecutionOutcome(
  request: ExecutionRequest,
  attempts: ExecutionAttempt[],
): { actualOutcome: string; comparisonResult: OutcomeComparisonResult; executionSucceeded: boolean } | null {
  const finalAttempt = attempts[attempts.length - 1]
  if (!finalAttempt) return null

  if (request.status === 'failed') {
    return {
      actualOutcome: finalAttempt.failureMessage ?? `Execution failed (${finalAttempt.failureKind ?? 'unknown reason'}).`,
      comparisonResult: 'miss',
      executionSucceeded: false,
    }
  }

  if (request.status === 'succeeded') {
    const verification = finalAttempt.result?.verification
    if (verification && typeof verification === 'object' && 'status' in verification && 'details' in verification) {
      const status = (verification as { status: unknown }).status
      const details = (verification as { details: unknown }).details
      if (typeof status === 'string' && typeof details === 'string') {
        const comparisonResult: OutcomeComparisonResult = status === 'verified' ? 'match' : status === 'mismatch' ? 'contradiction' : 'unknown'
        return { actualOutcome: details, comparisonResult, executionSucceeded: true }
      }
    }
    // Never claim a match without a genuine verification record — an honest "we don't know."
    return { actualOutcome: 'Execution reported success, but no independent verification was recorded.', comparisonResult: 'unknown', executionSucceeded: true }
  }

  return null
}

/**
 * Called from executeCapability.ts's own two exit points (a genuine
 * success and a final, non-retryable failure — see that file), unlike
 * the other six engines' single success-only hook: Execution Foundation
 * already has honest succeeded/failed semantics recorded in
 * execution_requests itself, so there is no risk of a failed execution
 * being written with status:'completed' — the status passed here is
 * always read directly off the just-fetched ExecutionRequest, never
 * assumed.
 *
 * No `parentRecordId` is set: an ExecutionRequest's `actionSnapshot` is a
 * frozen copy of the originating Action, not a pointer to the specific
 * intelligence_records row Action Intelligence's own ledger write (if
 * any) created for it — per the "never fabricate lineage" principle,
 * bridging that gap is Capability B's job.
 */
export async function recordExecutionIntelligenceRecord(params: {
  request: ExecutionRequest
  authorizations: ExecutionAuthorization[]
  attempts: ExecutionAttempt[]
}): Promise<void> {
  const { request, authorizations, attempts } = params
  const status: IntelligenceRecordStatus = request.status === 'succeeded' ? 'completed' : request.status === 'failed' ? 'failed' : 'running'

  const record = await writeIntelligenceRecord({
    workspaceId: request.workspaceId,
    recordType: 'execution',
    status,
    summary: `Execution: ${request.capability} (${request.status})`,
    structuredOutput: { requestId: request.id, capability: request.capability, status: request.status, expectedEffect: request.expectedEffect } as unknown as Record<string, unknown>,
    provenance: describeExecutionProvenance(request, authorizations, attempts),
    executionRequestId: request.id,
    // I8.1 — the execution's own real expected effect, already computed by buildExecutionContract.ts.
    expectedOutcome: request.expectedEffect,
  })

  if (!record) return

  const derived = deriveExecutionOutcome(request, attempts)
  if (!derived) return

  await writeIntelligenceOutcome({
    recordId: record.id,
    source: 'system_observed',
    expectedOutcome: request.expectedEffect,
    actualOutcome: derived.actualOutcome,
    comparisonResult: derived.comparisonResult,
    patternKey: deriveExecutionPatternKey(request.capability),
    executionSucceeded: derived.executionSucceeded,
  })
}
