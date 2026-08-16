import { describe, expect, it, vi } from 'vitest'

interface RpcResult<T> {
  data: T | null
  error: Error | null
}

const { rpcMock, fromMock } = vi.hoisted(() => ({
  rpcMock: vi.fn<(fn: string, args?: Record<string, unknown>) => Promise<RpcResult<unknown>>>(),
  fromMock: vi.fn(),
}))

vi.mock('@/shared/lib/supabase', () => ({ supabase: { rpc: rpcMock, from: fromMock } }))

import { EntitlementCheckFailedError, getPublicPlanCatalog, getStorageUsage, hasFeature } from '@/modules/plans/api/plans'

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

  it('fails closed on an RPC error — throws rather than resolving true, never granting a feature on an unverifiable check', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: new Error('boom') })

    await expect(hasFeature('user-1', 'collaboration')).rejects.toThrow(EntitlementCheckFailedError)
  })

  it('the thrown error never exposes the underlying Supabase error text', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: new Error('relation "plan_quotas" does not exist') })

    await expect(hasFeature('user-1', 'collaboration')).rejects.toThrow('We couldn’t verify your plan. Please try again.')
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

describe('getPublicPlanCatalog', () => {
  function mockCatalog(plans: unknown[], quotas: unknown[]) {
    fromMock.mockImplementation((table: string) => {
      if (table === 'plans') {
        return { select: () => ({ in: () => Promise.resolve({ data: plans, error: null }) }) }
      }
      if (table === 'plan_quotas') {
        return { select: () => ({ in: () => Promise.resolve({ data: quotas, error: null }) }) }
      }
      throw new Error(`unexpected table: ${table}`)
    })
  }

  it('joins plans + plan_quotas into a normalized tier, deriving collaboration from a >0 quota_limit', async () => {
    mockCatalog(
      [{ id: 'plan-1', code: 'pro', name: 'Pro', description: 'desc', active: true, monthly_price_cents: 1999, annual_price_cents: 19999, currency: 'USD' }],
      [
        { plan_id: 'plan-1', quota_key: 'ai_messages', quota_limit: 10000 },
        { plan_id: 'plan-1', quota_key: 'storage_bytes', quota_limit: 5368709120 },
        { plan_id: 'plan-1', quota_key: 'feature:collaboration', quota_limit: 1 },
      ],
    )

    const result = await getPublicPlanCatalog(['pro'])

    expect(result).toEqual([
      {
        planId: 'plan-1',
        code: 'pro',
        name: 'Pro',
        description: 'desc',
        active: true,
        monthlyPriceCents: 1999,
        annualPriceCents: 19999,
        currency: 'USD',
        aiMessagesPerMonth: 10000,
        storageBytes: 5368709120,
        collaboration: true,
      },
    ])
  })

  it('derives collaboration: false from a 0 quota_limit (Free\'s shape) rather than defaulting to true', async () => {
    mockCatalog(
      [{ id: 'plan-2', code: 'free', name: 'Free', description: null, active: true, monthly_price_cents: null, annual_price_cents: null, currency: 'USD' }],
      [{ plan_id: 'plan-2', quota_key: 'feature:collaboration', quota_limit: 0 }],
    )

    const result = await getPublicPlanCatalog(['free'])
    const [tier] = result

    expect(tier?.collaboration).toBe(false)
    expect(tier?.monthlyPriceCents).toBeNull()
  })

  it('returns null (not 0) for a quota key that has no row at all, never inventing a limit', async () => {
    mockCatalog([{ id: 'plan-3', code: 'beta', name: 'Beta', description: null, active: true, monthly_price_cents: null, annual_price_cents: null, currency: 'USD' }], [])

    const result = await getPublicPlanCatalog(['beta'])
    const [tier] = result

    expect(tier?.aiMessagesPerMonth).toBeNull()
    expect(tier?.storageBytes).toBeNull()
    expect(tier?.collaboration).toBe(false)
  })

  it('returns an empty array when the plans query itself fails, never throwing', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'plans') return { select: () => ({ in: () => Promise.resolve({ data: null, error: new Error('boom') }) }) }
      return { select: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) }
    })

    expect(await getPublicPlanCatalog(['pro'])).toEqual([])
  })
})
