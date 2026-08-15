import { decisionToProvenance } from '@/shared/provenance/adapters/decisionIntelligenceAdapter'
import { writeIntelligenceRecord } from '@/modules/intelligence-ledger/api/writeIntelligenceRecord'
import type { Decision } from '@/modules/decision-intelligence/decision'

/**
 * Called from runDecisionIntelligence.ts's own completion point, right
 * before it returns a status:'complete' decision — see that file.
 * Best-effort, per writeIntelligenceRecord.ts's own doc comment.
 *
 * No `parentRecordId` is set even when this decision was generated from
 * plan context: `PlanDerivedDecisionContext` (adaptPlanForDecisionContext.ts)
 * carries prose only, never the originating Plan's own ledger record id —
 * per the approved design's own "never fabricate lineage" instruction,
 * threading a real id through that boundary is Capability B's job, not
 * this phase's.
 */
export async function recordDecisionIntelligenceRecord(params: {
  decision: Decision
  workspaceId: string | null
  operationId: string
  providerId: string | null
}): Promise<void> {
  const { decision, workspaceId, operationId, providerId } = params

  await writeIntelligenceRecord({
    workspaceId,
    recordType: 'decision',
    summary: `Decision: ${decision.title}`,
    structuredOutput: decision as unknown as Record<string, unknown>,
    provenance: decisionToProvenance(decision),
    operationId,
    providerId,
  })
}
