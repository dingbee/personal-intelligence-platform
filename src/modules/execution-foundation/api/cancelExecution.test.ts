import { describe, expect, it, vi } from 'vitest'

interface RpcResult<T> {
  data: T | null
  error: Error | null
}

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn<(fn: string, args?: Record<string, unknown>) => Promise<RpcResult<unknown>>>(),
}))

vi.mock('@/shared/lib/supabase', () => ({ supabase: { rpc: rpcMock } }))

import { cancelExecution } from '@/modules/execution-foundation/api/cancelExecution'

const row = {
  id: 'req-1',
  user_id: 'user-1',
  workspace_id: 'ws-1',
  status: 'cancelled',
  action_snapshot: null,
  source: { kind: 'manual', label: 'Manual' },
  capability: 'save_action_to_notes',
  target: {},
  input_payload: {},
  expected_effect: 'Saves the action to a note.',
  risk_classification: 'low',
  external_side_effects: false,
  idempotency_key: 'hash-1',
  contract_hash: 'hash-1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  expires_at: '2026-01-02T00:00:00Z',
}

describe('cancelExecution', () => {
  it('calls cancel_execution with a null reason when none is given', async () => {
    rpcMock.mockResolvedValueOnce({ data: row, error: null })

    await cancelExecution('req-1')

    expect(rpcMock).toHaveBeenCalledWith('cancel_execution', { p_execution_request_id: 'req-1', p_reason: null })
  })

  it('passes an explicit reason through', async () => {
    rpcMock.mockResolvedValueOnce({ data: row, error: null })

    await cancelExecution('req-1', 'No longer needed')

    expect(rpcMock).toHaveBeenCalledWith('cancel_execution', { p_execution_request_id: 'req-1', p_reason: 'No longer needed' })
  })

  it('maps the returned row to a cancelled ExecutionRequest', async () => {
    rpcMock.mockResolvedValueOnce({ data: row, error: null })

    const result = await cancelExecution('req-1')

    expect(result.status).toBe('cancelled')
  })

  it('throws on an RPC error (e.g. cancelling a terminal request)', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: new Error('cancel_execution: request is already in a terminal state') })

    await expect(cancelExecution('req-1')).rejects.toThrow('terminal state')
  })
})
