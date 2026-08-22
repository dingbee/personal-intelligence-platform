import { getIntelligenceRecord } from '@/modules/intelligence-ledger/api/ledgerQueries'
import { getLearningSignal, listContradictingSignals, listEvidenceForSignal, listOutcomeEvaluationsByIds } from '@/modules/learning-intelligence/api/learningQueries'
import type { IntelligenceRecord } from '@/modules/intelligence-ledger/ledger'
import type { LearningSignal, OutcomeEvaluation } from '@/modules/learning-intelligence/learning'

export interface LearningEvidenceItem {
  evaluation: OutcomeEvaluation
  /** The real, already-persisted IntelligenceRecord this evaluation was made against — never fabricated. Null only if the record was independently deleted after the fact (should not happen under normal use — records cascade-delete their evaluations, not the reverse). */
  record: IntelligenceRecord | null
}

export interface LearningSignalProvenance {
  signal: LearningSignal
  /** The signal this one was created to contest, when applicable (I8.7) — never overwritten or deleted, always the real prior signal. */
  contradicts: LearningSignal | null
  /** Any signal(s) that were later created to contest THIS one. */
  contradictedBy: LearningSignal[]
  /** Every real evaluation that ever contributed evidence to this signal, oldest first — the reconstructable audit trail (I8.19/I8.20). */
  evidence: LearningEvidenceItem[]
}

/**
 * I8.19's own full chain, walked for real: LEARNING SIGNAL -> EVIDENCE
 * (OutcomeEvaluation) -> the real IntelligenceRecord it was evaluated
 * against -> that record's own already-computed provenance/executionRequestId/
 * parentRecordId (see IntelligenceRecordDetailPage.tsx, which already
 * renders a record's own upstream Plan/Decision/Execution links). Nothing
 * here invents a link that doesn't already exist in the database.
 */
export async function getLearningSignalProvenance(signalId: string): Promise<LearningSignalProvenance> {
  const signal = await getLearningSignal(signalId)

  const [contradicts, contradictedBy, evidenceLinks] = await Promise.all([
    signal.contradictsSignalId ? getLearningSignal(signal.contradictsSignalId) : Promise.resolve(null),
    listContradictingSignals(signalId),
    listEvidenceForSignal(signalId),
  ])

  const evaluations = await listOutcomeEvaluationsByIds(evidenceLinks.map((link) => link.evaluationId))
  const evaluationById = new Map(evaluations.map((e) => [e.id, e]))

  const recordIds = Array.from(new Set(evaluations.map((e) => e.recordId)))
  const records = await Promise.all(recordIds.map((id) => getIntelligenceRecord(id).catch(() => null)))
  const recordById = new Map(records.filter((r): r is IntelligenceRecord => r !== null).map((r) => [r.id, r]))

  const evidence: LearningEvidenceItem[] = evidenceLinks
    .map((link) => evaluationById.get(link.evaluationId))
    .filter((e): e is OutcomeEvaluation => e !== undefined)
    .map((evaluation) => ({ evaluation, record: recordById.get(evaluation.recordId) ?? null }))

  return { signal, contradicts, contradictedBy, evidence }
}
