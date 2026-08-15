import { analysisInvestigationToProvenance } from '@/shared/provenance/adapters/analysisIntelligenceAdapter'
import { writeIntelligenceRecord } from '@/modules/intelligence-ledger/api/writeIntelligenceRecord'
import type { AnalysisInvestigation } from '@/modules/analysis-intelligence/analysisInvestigation'

/** Called from runAnalysisInvestigation.ts's own completion point, right before it returns a genuinely synthesized (not budget-exhausted, not declined/failed) investigation — see that file. Best-effort, per writeIntelligenceRecord.ts's own doc comment. */
export async function recordAnalysisIntelligenceRecord(params: {
  investigation: AnalysisInvestigation
  workspaceId: string | null
  operationId: string
  providerId: string | null
}): Promise<void> {
  const { investigation, workspaceId, operationId, providerId } = params

  await writeIntelligenceRecord({
    workspaceId,
    recordType: 'analysis',
    summary: `Analysis Intelligence: ${investigation.question}`,
    structuredOutput: investigation as unknown as Record<string, unknown>,
    provenance: analysisInvestigationToProvenance(investigation),
    operationId,
    providerId,
  })
}
