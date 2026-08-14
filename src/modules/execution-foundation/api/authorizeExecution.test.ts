import { describe, expect, it, vi } from 'vitest'

interface RpcResult<T> {
  data: T | null
  error: Error | null
}

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn<(fn: string, args?: Record<string, unknown>) => Promise<RpcResult<unknown>>>(),
}))

vi.mock('@/shared/lib/supabase', () => ({ supabase: { rpc: rpcMock } }))

import { authorizeExecution } from '@/modules/execution-foundation/api/authorizeExecution'

const row = {
  id: 'auth-1',
  execution_request_id: 'req-1',
  approving_user_id: 'user-1',
  decision: 'approved',
  capability: 'save_action_to_notes',
  target: {},
  scope: {},
  contract_hash_at_approval: 'hash-1',
  expires_at: null,
  created_at: '2026-01-01T00:00:00Z',
}

describe('authorizeExecution', () => {
  it('calls authorize_execution_request with the decision and defaults', async () => {
    rpcMock.mockResolvedValueOnce({ data: row, error: null })

    await authorizeExecution({ executionRequestId: 'req-1', decision: 'approved' })

    expect(rpcMock).toHaveBeenCalledWith('authorize_execution_request', {
      p_execution_request_id: 'req-1',
      p_decision: 'approved',
      p_scope: {},
      p_expires_at: null,
    })
  })

  it('passes through an explicit rejection decision', async () => {
    rpcMock.mockResolvedValueOnce({ data: { ...row, decision: 'rejected' }, error: null })

    const result = await authorizeExecution({ executionRequestId: 'req-1', decision: 'rejected' })

    expect(result.decision).toBe('rejected')
  })

  it('maps the returned row to a domain ExecutionAuthorization, never a bare approved:true', async () => {
    rpcMock.mockResolvedValueOnce({ data: row, error: null })

    const result = await authorizeExecution({ executionRequestId: 'req-1', decision: 'approved' })

    expect(result).toEqual({
      id: 'auth-1',
      executionRequestId: 'req-1',
      approvingUserId: 'user-1',
      decision: 'approved',
      capability: 'save_action_to_notes',
      target: {},
      scope: {},
      contractHashAtApproval: 'hash-1',
      expiresAt: null,
      createdAt: '2026-01-01T00:00:00Z',
    })
  })

  it('throws on an RPC error (e.g. expired or already-decided request)', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: new Error('authorize_execution_request: request is not awaiting approval') })

    await expect(authorizeExecution({ executionRequestId: 'req-1', decision: 'approved' })).rejects.toThrow('not awaiting approval')
  })
})
