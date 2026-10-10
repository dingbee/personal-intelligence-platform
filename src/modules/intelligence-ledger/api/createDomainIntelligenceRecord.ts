import { toIntelligenceRecord } from '@/modules/intelligence-ledger/api/mappers'
import type { CreateIntelligenceRecordParams, IntelligenceRecord } from '@/modules/intelligence-ledger/ledger'
import {
  validateDomainIntelligenceOutput,
  type DomainIntelligenceOutput,
  type IntelligenceDomainKey,
  type IntelligencePersistenceOutcome,
} from '@/modules/intelligence-ledger/domainContract'
import { supabase } from '@/shared/lib/supabase'

export interface CreateDomainIntelligenceRecordParams extends Omit<CreateIntelligenceRecordParams, 'structuredOutput'> {
  domainKey: IntelligenceDomainKey
  structuredOutput: DomainIntelligenceOutput
}

/** Strict, domain-aware entry point. Validation runs client-side for fast feedback and again at the database boundary. */
export async function createDomainIntelligenceRecord(
  params: CreateDomainIntelligenceRecordParams,
): Promise<IntelligenceRecord> {
  const { domainKey, workspaceId, journeyId = null, recordType, summary, structuredOutput,
    status = 'completed', provenance = null, operationId = null, providerId = null,
    conversationId = null, executionRequestId = null, parentRecordId = null, expectedOutcome = null } = params

  if (!validateDomainIntelligenceOutput(structuredOutput, domainKey)) {
    throw new Error('Domain intelligence output failed IF-02 contract validation')
  }

  const { data, error } = await supabase.rpc('create_domain_intelligence_record', {
    p_domain_key: domainKey,
    p_workspace_id: workspaceId,
    p_journey_id: journeyId,
    p_record_type: recordType,
    p_summary: summary,
    p_structured_output: structuredOutput as unknown as Record<string, unknown>,
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

/** Explicit best-effort persistence result: callers can distinguish a durable record from a failed optional write. */
export async function writeDomainIntelligenceRecord(
  params: CreateDomainIntelligenceRecordParams,
): Promise<IntelligencePersistenceOutcome> {
  try {
    const record = await createDomainIntelligenceRecord(params)
    return { status: 'persisted', recordId: record.id, domain: params.domainKey }
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown persistence failure'
    console.error('[intelligence-ledger] failed to persist domain intelligence record', { domain: params.domainKey, reason })
    return { status: 'not_persisted', domain: params.domainKey, reason }
  }
}
