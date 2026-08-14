import { describe, expect, it, vi } from 'vitest'

interface RpcResult<T> {
  data: T | null
  error: Error | null
}

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn<(fn: string, args?: Record<string, unknown>) => Promise<RpcResult<unknown>>>(),
}))

vi.mock('@/shared/lib/supabase', () => ({ supabase: { rpc: rpcMock } }))

import { createExecutionRequest } from '@/modules/execution-foundation/api/createExecutionRequest'
import type { ExecutionContract, ExecutionSource } from '@/modules/execution-foundation/execution'

const contract: ExecutionContract = {
  capability: 'save_action_to_notes',
  target: {},
  inputPayload: { actionId: 'action-1' },
  expectedEffect: 'Saves the action to a note.',
  riskClassification: 'low',
  externalSideEffects: false,
}
const source: ExecutionSource = { kind: 'action', actionId: 'action-1', actionSource: { kind: 'plan', label: 'Plan' } }

const row = {
  id: 'req-1',
  user_id: 'user-1',
  workspace_id: 'ws-1',
  status: 'awaiting_approval',
  action_snapshot: null,
  source,
  capability: 'save_action_to_notes',
  target: {},
  input_payload: { actionId: 'action-1' },
  expected_effect: 'Saves the action to a note.',
  risk_classification: 'low',
  external_side_effects: false,
  idempotency_key: 'hash-1',
  contract_hash: 'hash-1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  expires_at: '2026-01-02T00:00:00Z',
}

describe('createExecutionRequest', () => {
  it('computes the contract hash and passes it as both idempotency_key and contract_hash', async () => {
    rpcMock.mockResolvedValueOnce({ data: row, error: null })

    await createExecutionRequest({ workspaceId: 'ws-1', contract, source, actionSnapshot: null })

    expect(rpcMock).toHaveBeenCalledTimes(1)
    const [fn, args] = rpcMock.mock.calls[0]!
    expect(fn).toBe('create_execution_request')
    expect(args?.p_idempotency_key).toBe(args?.p_contract_hash)
    expect(typeof args?.p_idempotency_key).toBe('string')
    expect((args!.p_idempotency_key as string).length).toBe(64)
    expect(args?.p_capability).toBe('save_action_to_notes')
    expect(args?.p_ttl_seconds).toBe(24 * 60 * 60)
  })

  it('maps the returned row to a domain ExecutionRequest', async () => {
    rpcMock.mockResolvedValueOnce({ data: row, error: null })

    const result = await createExecutionRequest({ workspaceId: 'ws-1', contract, source, actionSnapshot: null })

    expect(result).toMatchObject({ id: 'req-1', status: 'awaiting_approval', capability: 'save_action_to_notes', contractHash: 'hash-1' })
  })

  it('throws on an RPC error', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: new Error('unique violation') })

    await expect(createExecutionRequest({ workspaceId: 'ws-1', contract, source, actionSnapshot: null })).rejects.toThrow('unique violation')
  })

  it('identical contracts hash identically, giving create_execution_request the same idempotency key both times', async () => {
    rpcMock.mockResolvedValue({ data: row, error: null })

    await createExecutionRequest({ workspaceId: 'ws-1', contract, source, actionSnapshot: null })
    await createExecutionRequest({ workspaceId: 'ws-1', contract, source, actionSnapshot: null })

    const [, argsA] = rpcMock.mock.calls[0]!
    const [, argsB] = rpcMock.mock.calls[1]!
    expect(argsA?.p_idempotency_key).toBe(argsB?.p_idempotency_key)
  })
})
