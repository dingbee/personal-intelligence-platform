import { actionSetToProvenance } from '@/shared/provenance/adapters/actionIntelligenceAdapter'
import { writeIntelligenceRecord } from '@/modules/intelligence-ledger/api/writeIntelligenceRecord'
import type { ActionSet } from '@/modules/action-intelligence/action'

/**
 * Called from runActionIntelligence.ts's own completion point, right
 * before it returns a status:'complete' action set — see that file.
 * Best-effort, per writeIntelligenceRecord.ts's own doc comment.
 *
 * No `parentRecordId` is set even when this action set was derived from
 * plan/decision context — same "never fabricate lineage" reasoning as
 * recordDecisionIntelligenceRecord.ts: `PlanDerivedActionContext`/
 * `DecisionDerivedActionContext` carry prose only, never a real
 * upstream ledger record id.
 */
export async function recordActionIntelligenceRecord(params: {
  actionSet: ActionSet
  workspaceId: string | null
  operationId: string
  providerId: string | null
}): Promise<void> {
  const { actionSet, workspaceId, operationId, providerId } = params

  await writeIntelligenceRecord({
    workspaceId,
    recordType: 'action',
    summary: `Action set: ${actionSet.title}`,
    structuredOutput: actionSet as unknown as Record<string, unknown>,
    provenance: actionSetToProvenance(actionSet),
    operationId,
    providerId,
    // I8.1 — a batch-level summary only, for display/traceability. An
    // individual action's real fate is only knowable through its own
    // execution (I7) — see recordExecutionIntelligenceRecord.ts, the
    // actual I8.18 action-outcome-learning integration point. Null when
    // the set has no actions to summarize (a declined/failed set).
    expectedOutcome: actionSet.actions.length > 0 ? actionSet.actions.map((a) => a.expectedOutput.outcome).join('; ') : null,
  })
}
