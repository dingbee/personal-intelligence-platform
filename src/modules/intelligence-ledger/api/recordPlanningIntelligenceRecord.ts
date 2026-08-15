import { planToProvenance } from '@/shared/provenance/adapters/planningIntelligenceAdapter'
import { writeIntelligenceRecord } from '@/modules/intelligence-ledger/api/writeIntelligenceRecord'
import type { Plan } from '@/modules/planning-intelligence/plan'

/** Called from runPlanningIntelligence.ts's own completion point, right before it returns a status:'complete' plan — see that file. Best-effort, per writeIntelligenceRecord.ts's own doc comment. */
export async function recordPlanningIntelligenceRecord(params: {
  plan: Plan
  workspaceId: string | null
  operationId: string
  providerId: string | null
}): Promise<void> {
  const { plan, workspaceId, operationId, providerId } = params

  await writeIntelligenceRecord({
    workspaceId,
    recordType: 'planning',
    summary: `Plan: ${plan.title}`,
    structuredOutput: plan as unknown as Record<string, unknown>,
    provenance: planToProvenance(plan),
    operationId,
    providerId,
  })
}
