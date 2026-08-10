import { describe, expect, it, vi } from 'vitest'

interface RpcResult<T> {
  data: T | null
  error: Error | null
}

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn<(fn: string, args?: Record<string, unknown>) => Promise<RpcResult<unknown>>>(),
}))

vi.mock('@/shared/lib/supabase', () => ({ supabase: { rpc: rpcMock } }))

import { getStorageUsage, hasFeature } from '@/modules/plans/api/plans'

describe('hasFeature', () => {
  it('calls the has_feature RPC with the user id and feature key', async () => {
    rpcMock.mockResolvedValueOnce({ data: true, error: null })

    await hasFeature('user-1', 'collaboration')

    expect(rpcMock).toHaveBeenCalledWith('has_feature', { p_user_id: 'user-1', p_feature_key: 'collaboration' })
  })

  it('returns the resolved boolean', async () => {
    rpcMock.mockResolvedValueOnce({ data: true, error: null })
    expect(await hasFeature('user-1', 'collaboration')).toBe(true)

    rpcMock.mockResolvedValueOnce({ data: false, error: null })
    expect(await hasFeature('user-1', 'collaboration')).toBe(false)
  })

  it('fails closed (false) on an RPC error, never granting a feature on an unverifiable check', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: new Error('boom') })

    expect(await hasFeature('user-1', 'collaboration')).toBe(false)
  })
})

describe('getStorageUsage', () => {
  it('resolves usage and limit through calculate_user_storage_usage / resolve_effective_quota_limit', async () => {
    rpcMock.mockImplementation((fn: string) => {
      if (fn === 'calculate_user_storage_usage') return Promise.resolve({ data: 12345, error: null })
      if (fn === 'resolve_effective_quota_limit') return Promise.resolve({ data: 524288000, error: null })
      throw new Error(`unexpected rpc: ${fn}`)
    })

    const result = await getStorageUsage('user-1')

    expect(result).toEqual({ used: 12345, limit: 524288000 })
    expect(rpcMock).toHaveBeenCalledWith('calculate_user_storage_usage', { p_user_id: 'user-1' })
    expect(rpcMock).toHaveBeenCalledWith('resolve_effective_quota_limit', { p_user_id: 'user-1', p_quota_key: 'storage_bytes' })
  })

  it('defaults usage to 0 and limit to null on error, matching resolve_effective_quota_limit’s null-means-unresolved contract', async () => {
    rpcMock.mockResolvedValue({ data: null, error: new Error('boom') })

    const result = await getStorageUsage('user-1')

    expect(result).toEqual({ used: 0, limit: null })
  })
})
