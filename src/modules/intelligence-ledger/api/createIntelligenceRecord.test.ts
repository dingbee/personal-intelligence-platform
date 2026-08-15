import { describe, expect, it, vi } from 'vitest'

interface RpcResult<T> {
  data: T | null
  error: Error | null
}

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn<(fn: string, args?: Record<string, unknown>) => Promise<RpcResult<unknown>>>(),
}))

vi.mock('@/shared/lib/supabase', () => ({ supabase: { rpc: rpcMock } }))

import { createIntelligenceRecord } from '@/modules/intelligence-ledger/api/createIntelligenceRecord'

const ROW = {
  id: 'record-1',
  workspace_id: 'workspace-1',
  user_id: 'user-1',
  journey_id: null,
  record_type: 'research',
  status: 'completed',
  summary: 'Research Intelligence: what changed?',
  structured_output: { question: 'what changed?' },
  provenance: { evidence: [], derivations: [] },
  operation_id: 'operation-1',
  provider_id: 'openai',
  conversation_id: null,
  execution_request_id: null,
  parent_record_id: null,
  expected_outcome: null,
  actual_outcome: null,
  outcome_evaluated_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

describe('createIntelligenceRecord', () => {
  it('calls create_intelligence_record with every param mapped to its p_ argument, applying documented defaults', async () => {
    rpcMock.mockResolvedValueOnce({ data: ROW, error: null })

    await createIntelligenceRecord({
      workspaceId: 'workspace-1',
      recordType: 'research',
      summary: 'Research Intelligence: what changed?',
      structuredOutput: { question: 'what changed?' },
    })

    expect(rpcMock).toHaveBeenCalledWith('create_intelligence_record', {
      p_workspace_id: 'workspace-1',
      p_journey_id: null,
      p_record_type: 'research',
      p_summary: 'Research Intelligence: what changed?',
      p_structured_output: { question: 'what changed?' },
      p_status: 'completed',
      p_provenance: null,
      p_operation_id: null,
      p_provider_id: null,
      p_conversation_id: null,
      p_execution_request_id: null,
      p_parent_record_id: null,
      p_expected_outcome: null,
    })
  })

  it('passes every optional field through unchanged when supplied — never silently drops lineage/provenance/provider data', async () => {
    rpcMock.mockResolvedValueOnce({ data: ROW, error: null })

    await createIntelligenceRecord({
      workspaceId: 'workspace-1',
      journeyId: 'journey-1',
      recordType: 'execution',
      status: 'failed',
      summary: 'Execution: send_email (failed)',
      structuredOutput: { requestId: 'exec-1' },
      provenance: { source: { kind: 'manual', label: 'x' }, actionEvidenceIds: [], authorization: null, attempts: [], result: null },
      operationId: null,
      providerId: null,
      conversationId: 'conversation-1',
      executionRequestId: 'exec-1',
      parentRecordId: 'record-0',
      expectedOutcome: 'the email is sent',
    })

    expect(rpcMock).toHaveBeenCalledWith(
      'create_intelligence_record',
      expect.objectContaining({
        p_journey_id: 'journey-1',
        p_status: 'failed',
        p_conversation_id: 'conversation-1',
        p_execution_request_id: 'exec-1',
        p_parent_record_id: 'record-0',
        p_expected_outcome: 'the email is sent',
      }),
    )
  })

  it('maps the returned row into a domain IntelligenceRecord', async () => {
    rpcMock.mockResolvedValueOnce({ data: ROW, error: null })

    const record = await createIntelligenceRecord({
      workspaceId: 'workspace-1',
      recordType: 'research',
      summary: 'Research Intelligence: what changed?',
      structuredOutput: { question: 'what changed?' },
    })

    expect(record.id).toBe('record-1')
    expect(record.recordType).toBe('research')
    expect(record.status).toBe('completed')
  })

  it('throws on an RPC error — callers that must never fail silently should not use this function directly', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: new Error('forged user_id rejected') })

    await expect(
      createIntelligenceRecord({ workspaceId: 'workspace-1', recordType: 'research', summary: 'x', structuredOutput: {} }),
    ).rejects.toThrow('forged user_id rejected')
  })
})
