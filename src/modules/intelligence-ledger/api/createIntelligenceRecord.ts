import { supabase } from '@/shared/lib/supabase'
import { toIntelligenceRecord } from '@/modules/intelligence-ledger/api/mappers'
import type { CreateIntelligenceRecordParams, IntelligenceRecord } from '@/modules/intelligence-ledger/ledger'

/**
 * The only way an intelligence_records row can be created — see
 * create_intelligence_record() in 0066_intelligence_ledger.sql. user_id
 * is always set server-side from auth.uid(), never client-supplied; the
 * RPC itself verifies any referenced journey/parent-record/execution-
 * request actually belongs to the caller and that the caller has at
 * least viewer access to workspace_id, so a client cannot forge lineage
 * or escape a workspace boundary by editing these params.
 *
 * This function throws on failure — callers that must never let a
 * Ledger-write failure affect the calling engine's own return value
 * should go through writeIntelligenceRecord.ts instead, not this
 * function directly.
 */
export async function createIntelligenceRecord(params: CreateIntelligenceRecordParams): Promise<IntelligenceRecord> {
  const {
    workspaceId,
    journeyId = null,
    recordType,
    status = 'completed',
    summary,
    structuredOutput,
    provenance = null,
    operationId = null,
    providerId = null,
    conversationId = null,
    executionRequestId = null,
    parentRecordId = null,
    expectedOutcome = null,
  } = params

  const { data, error } = await supabase.rpc('create_intelligence_record', {
    p_workspace_id: workspaceId,
    p_journey_id: journeyId,
    p_record_type: recordType,
    p_summary: summary,
    p_structured_output: structuredOutput,
    p_status: status,
    p_provenance: provenance as Record<string, unknown> | null,
    p_operation_id: operationId,
    p_provider_id: providerId,
    p_conversation_id: conversationId,
    p_execution_request_id: executionRequestId,
    p_parent_record_id: parentRecordId,
    p_expected_outcome: expectedOutcome,
  })
  if (error) throw error
  return toIntelligenceRecord(data)
}
