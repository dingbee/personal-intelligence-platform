import { describeExecutionProvenance } from '@/shared/provenance/adapters/executionAdapter'
import { writeIntelligenceRecord } from '@/modules/intelligence-ledger/api/writeIntelligenceRecord'
import type { ExecutionAttempt, ExecutionAuthorization, ExecutionRequest } from '@/modules/execution-foundation/execution'
import type { IntelligenceRecordStatus } from '@/shared/types/database'

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

  await writeIntelligenceRecord({
    workspaceId: request.workspaceId,
    recordType: 'execution',
    status,
    summary: `Execution: ${request.capability} (${request.status})`,
    structuredOutput: { requestId: request.id, capability: request.capability, status: request.status, expectedEffect: request.expectedEffect } as unknown as Record<string, unknown>,
    provenance: describeExecutionProvenance(request, authorizations, attempts),
    executionRequestId: request.id,
  })
}
