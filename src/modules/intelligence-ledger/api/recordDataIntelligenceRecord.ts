import { analyticalResultToProvenance } from '@/shared/provenance/adapters/dataIntelligenceAdapter'
import { writeIntelligenceRecord } from '@/modules/intelligence-ledger/api/writeIntelligenceRecord'
import type { AnalyticalResult } from '@/modules/data-intelligence/analyticalPlan'

/**
 * Called from runDataIntelligenceQuery.ts's own completion point, right
 * before it returns status:'answered' — see that file. Best-effort: a
 * Ledger write failure here is logged, never thrown, never alters the
 * query's own answer.
 *
 * dataIntelligenceAdapter's analyticalResultToProvenance returns the
 * narrower `{evidence, derivation} | null` shape (a single derivation),
 * not a full ProvenanceChain — normalized here into the same
 * `{evidence: [...], derivations: [...]}` shape every other record type
 * uses, without touching the adapter itself.
 */
export async function recordDataIntelligenceRecord(params: {
  question: string
  answer: string
  result: AnalyticalResult
  workspaceId: string | null
  operationId: string
  providerId: string | null
}): Promise<void> {
  const { question, answer, result, workspaceId, operationId, providerId } = params
  const adapterOutput = analyticalResultToProvenance(result)
  const provenance = adapterOutput ? { evidence: [adapterOutput.evidence], derivations: [adapterOutput.derivation] } : null

  await writeIntelligenceRecord({
    workspaceId,
    recordType: 'data',
    summary: `Data Intelligence: ${question}`,
    structuredOutput: { question, answer, result } as unknown as Record<string, unknown>,
    provenance,
    operationId,
    providerId,
  })
}
