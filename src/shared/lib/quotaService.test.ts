import { describe, expect, it, vi } from 'vitest'

interface QueryResult<T> {
  data: T | null
  error: Error | null
}

/** A chainable `.eq(...).eq(...)....maybeSingle()` stub for the one remaining direct table read (quota_usage). */
function chain<T>(maybeSingle: () => Promise<QueryResult<T>>) {
  const node: { eq: () => typeof node; maybeSingle: () => Promise<QueryResult<T>> } = {
    eq: () => node,
    maybeSingle,
  }
  return node
}

const { fromMock, rpcMock, usageMaybeSingle } = vi.hoisted(() => {
  const usageMaybeSingle = vi.fn<() => Promise<QueryResult<{ usage_count: number }>>>()
  const rpcMock = vi.fn<() => Promise<QueryResult<unknown>>>()
  const fromMock = vi.fn((table: string) => {
    if (table === 'quota_usage') return { select: () => chain(usageMaybeSingle) }
    throw new Error(`unexpected table: ${table}`)
  })
  return { fromMock, rpcMock, usageMaybeSingle }
})

vi.mock('@/shared/lib/supabase', () => ({ supabase: { from: fromMock, rpc: rpcMock } }))

import { quotaService } from '@/shared/lib/quotaService'

describe('quotaService.checkQuota', () => {
  it('resolves the effective limit through resolve_effective_quota_limit, not a hand-rolled plan/quota lookup', async () => {
    rpcMock.mockResolvedValueOnce({ data: 1000, error: null })
    usageMaybeSingle.mockResolvedValueOnce({ data: null, error: null })

    await quotaService.checkQuota('user-1', 'ai_messages')

    expect(rpcMock).toHaveBeenCalledWith('resolve_effective_quota_limit', { p_user_id: 'user-1', p_quota_key: 'ai_messages' })
  })

  it('is not allowed when resolution errors, with an honest reason distinct from "no plan" (PIP Sprint 8/10)', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: new Error('boom') })

    const result = await quotaService.checkQuota('user-1', 'ai_messages')

    expect(result).toEqual({ allowed: false, reason: 'Could not verify your plan — please try again.' })
  })

  it('is not allowed when there is no active plan or no quota configured for the key (both resolve to null)', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null })

    const result = await quotaService.checkQuota('user-1', 'unknown_key')

    expect(result).toEqual({ allowed: false, reason: 'No active plan or quota configured for your account.' })
  })

  it('allows usage under the limit, defaulting to 0 used when no usage row exists yet this period', async () => {
    rpcMock.mockResolvedValueOnce({ data: 1000, error: null })
    usageMaybeSingle.mockResolvedValueOnce({ data: null, error: null })

    const result = await quotaService.checkQuota('user-1', 'ai_messages')

    expect(result).toEqual({ allowed: true, used: 0, limit: 1000 })
  })

  it('allows usage strictly below the limit', async () => {
    rpcMock.mockResolvedValueOnce({ data: 100, error: null })
    usageMaybeSingle.mockResolvedValueOnce({ data: { usage_count: 99 }, error: null })

    const result = await quotaService.checkQuota('user-1', 'ai_messages')

    expect(result).toEqual({ allowed: true, used: 99, limit: 100 })
  })

  it('denies usage at the limit', async () => {
    rpcMock.mockResolvedValueOnce({ data: 100, error: null })
    usageMaybeSingle.mockResolvedValueOnce({ data: { usage_count: 100 }, error: null })

    const result = await quotaService.checkQuota('user-1', 'ai_messages')

    expect(result).toEqual({ allowed: false, used: 100, limit: 100 })
  })

  it('denies usage over the limit', async () => {
    rpcMock.mockResolvedValueOnce({ data: 100, error: null })
    usageMaybeSingle.mockResolvedValueOnce({ data: { usage_count: 150 }, error: null })

    const result = await quotaService.checkQuota('user-1', 'ai_messages')

    expect(result).toEqual({ allowed: false, used: 150, limit: 100 })
  })

  it('reports a personal override as the effective limit, exactly as resolve_effective_quota_limit returns it', async () => {
    rpcMock.mockResolvedValueOnce({ data: 250, error: null })
    usageMaybeSingle.mockResolvedValueOnce({ data: { usage_count: 37 }, error: null })

    const result = await quotaService.checkQuota('user-1', 'ai_messages')

    expect(result).toEqual({ allowed: true, used: 37, limit: 250 })
  })
})

describe('quotaService.consumeQuota', () => {
  it('calls the consume_quota RPC with the quota key and returns true', async () => {
    rpcMock.mockResolvedValueOnce({ data: [{ usage_count: 1, quota_limit: 1000, allowed: true }], error: null })

    const result = await quotaService.consumeQuota('user-1', 'ai_messages')

    expect(result).toBe(true)
    expect(rpcMock).toHaveBeenCalledWith('consume_quota', { p_quota_key: 'ai_messages' })
  })

  it('throws when the RPC errors, so a successful AI response is never silently unmetered', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: new Error('rpc failed') })

    await expect(quotaService.consumeQuota('user-1', 'ai_messages')).rejects.toThrow('rpc failed')
  })
})
