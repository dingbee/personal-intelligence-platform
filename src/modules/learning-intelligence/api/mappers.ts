import type { IntelligenceLearningEvidenceRow, IntelligenceLearningSignalRow, IntelligenceOutcomeEvaluationRow } from '@/shared/types/database'
import type { LearningEvidenceLink, LearningSignal, OutcomeEvaluation } from '@/modules/learning-intelligence/learning'

/** DB row (snake_case) -> domain type (camelCase). One direction only — every mutation goes through an RPC that returns its own already-mappable row. */
export function toOutcomeEvaluation(row: IntelligenceOutcomeEvaluationRow): OutcomeEvaluation {
  return {
    id: row.id,
    userId: row.user_id,
    workspaceId: row.workspace_id,
    recordId: row.record_id,
    source: row.source,
    expectedOutcome: row.expected_outcome,
    actualOutcome: row.actual_outcome,
    comparisonResult: row.comparison_result,
    executionSucceeded: row.execution_succeeded,
    feedbackNote: row.feedback_note,
    patternKey: row.pattern_key,
    createdAt: row.created_at,
  }
}

export function toLearningSignal(row: IntelligenceLearningSignalRow): LearningSignal {
  return {
    id: row.id,
    userId: row.user_id,
    workspaceId: row.workspace_id,
    recordType: row.record_type,
    patternKey: row.pattern_key,
    direction: row.direction,
    statement: row.statement,
    strength: row.strength,
    status: row.status,
    evidenceCount: row.evidence_count,
    contradictsSignalId: row.contradicts_signal_id,
    revokedReason: row.revoked_reason,
    revokedAt: row.revoked_at,
    firstEvidenceAt: row.first_evidence_at,
    lastEvidenceAt: row.last_evidence_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toLearningEvidenceLink(row: IntelligenceLearningEvidenceRow): LearningEvidenceLink {
  return { id: row.id, signalId: row.signal_id, evaluationId: row.evaluation_id, createdAt: row.created_at }
}
