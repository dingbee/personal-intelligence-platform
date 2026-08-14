import { describe, expect, it, vi } from 'vitest'

interface RpcResult<T> {
  data: T | null
  error: Error | null
}

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn<(fn: string, args?: Record<string, unknown>) => Promise<RpcResult<unknown>>>(),
}))

vi.mock('@/shared/lib/supabase', () => ({ supabase: { rpc: rpcMock } }))

import { expireExecution } from '@/modules/execution-foundation/api/expireExecution'

const row = {
  id: 'req-1',
  user_id: 'user-1',
  workspace_id: 'ws-1',
  status: 'expired',
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
  expires_at: '2026-01-01T00:00:01Z',
}

describe('expireExecution', () => {
  it('calls expire_execution with the request id', async () => {
    rpcMock.mockResolvedValueOnce({ data: row, error: null })

    await expireExecution('req-1')

    expect(rpcMock).toHaveBeenCalledWith('expire_execution', { p_execution_request_id: 'req-1' })
  })

  it('maps the returned row to an expired ExecutionRequest', async () => {
    rpcMock.mockResolvedValueOnce({ data: row, error: null })

    const result = await expireExecution('req-1')

    expect(result.status).toBe('expired')
  })

  it('throws when the server-side clock disagrees that the request has actually expired', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: new Error('expire_execution: request has not yet expired') })

    await expect(expireExecution('req-1')).rejects.toThrow('has not yet expired')
  })
})
