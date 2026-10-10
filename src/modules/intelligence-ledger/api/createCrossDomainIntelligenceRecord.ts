import { toIntelligenceRecord } from '@/modules/intelligence-ledger/api/mappers'
import type { IntelligenceRecord } from '@/modules/intelligence-ledger/ledger'
import { supabase } from '@/shared/lib/supabase'

export interface CreateCrossDomainIntelligenceRecordParams {
  workspaceId: string | null
  summary: string
  structuredOutput: Record<string, unknown>
  operationId?: string | null
  providerId?: string | null
}

/** Trusted IF-04 RPC: entitlement and approval checks run at the database boundary. */
export async function createCrossDomainIntelligenceRecord(params: CreateCrossDomainIntelligenceRecordParams): Promise<IntelligenceRecord> {
  const { data, error } = await supabase.rpc('create_cross_domain_intelligence_record', {
    p_workspace_id: params.workspaceId,
    p_summary: params.summary,
    p_structured_output: params.structuredOutput,
    p_operation_id: params.operationId ?? null,
    p_provider_id: params.providerId ?? null,
  })
  if (error) throw error
  return toIntelligenceRecord(data)
}