import { researchInvestigationToProvenance } from '@/shared/provenance/adapters/researchIntelligenceAdapter'
import { writeIntelligenceRecord } from '@/modules/intelligence-ledger/api/writeIntelligenceRecord'
import type { ResearchInvestigation } from '@/modules/research-intelligence/researchInvestigation'

/** Called from runResearchInvestigation.ts's own completion point, right before it returns a genuinely synthesized investigation — see that file. Best-effort, per writeIntelligenceRecord.ts's own doc comment. */
export async function recordResearchIntelligenceRecord(params: {
  investigation: ResearchInvestigation
  workspaceId: string | null
  operationId: string
  providerId: string | null
}): Promise<void> {
  const { investigation, workspaceId, operationId, providerId } = params

  await writeIntelligenceRecord({
    workspaceId,
    recordType: 'research',
    summary: `Research Intelligence: ${investigation.question}`,
    structuredOutput: investigation as unknown as Record<string, unknown>,
    provenance: researchInvestigationToProvenance(investigation),
    operationId,
    providerId,
  })
}
