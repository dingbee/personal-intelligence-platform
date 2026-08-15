import type { IntelligenceJourneyRow, IntelligenceRecordRow } from '@/shared/types/database'
import type { IntelligenceJourney, IntelligenceRecord } from '@/modules/intelligence-ledger/ledger'

/** DB row (snake_case) -> domain type (camelCase). One direction only — this module never writes a row back; every mutation goes through an RPC that returns its own already-mappable row. */
export function toIntelligenceJourney(row: IntelligenceJourneyRow): IntelligenceJourney {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    objectiveId: row.objective_id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toIntelligenceRecord(row: IntelligenceRecordRow): IntelligenceRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    journeyId: row.journey_id,
    recordType: row.record_type,
    status: row.status,
    summary: row.summary,
    structuredOutput: row.structured_output,
    provenance: row.provenance as IntelligenceRecord['provenance'],
    operationId: row.operation_id,
    providerId: row.provider_id,
    conversationId: row.conversation_id,
    executionRequestId: row.execution_request_id,
    parentRecordId: row.parent_record_id,
    expectedOutcome: row.expected_outcome,
    actualOutcome: row.actual_outcome,
    outcomeEvaluatedAt: row.outcome_evaluated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
