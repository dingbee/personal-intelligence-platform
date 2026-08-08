import { describe, expect, it, vi } from 'vitest'

interface QueryResult<T> {
  data: T | null
  error: Error | null
}

/** A chainable `.eq(...).eq(...)....maybeSingle()` stub — each table's query in quotaService.ts has a different number of `.eq()` calls, so `eq()` just returns `this` until `.maybeSingle()` resolves. */
function chain<T>(maybeSingle: () => Promise<QueryResult<T>>) {
  const node: { eq: () => typeof node; maybeSingle: () => Promise<QueryResult<T>> } = {
    eq: () => node,
    maybeSingle,
  }
  return node
}

const { fromMock, rpcMock, assignmentMaybeSingle, quotaMaybeSingle, usageMaybeSingle } = vi.hoisted(() => {
  const assignmentMaybeSingle = vi.fn<() => Promise<QueryResult<{ plan_id: string }>>>()
  const quotaMaybeSingle = vi.fn<() => Promise<QueryResult<{ quota_limit: number }>>>()
  const usageMaybeSingle = vi.fn<() => Promise<QueryResult<{ usage_count: number }>>>()
  const rpcMock = vi.fn<() => Promise<QueryResult<unknown>>>()
  const fromMock = vi.fn((table: string) => {
    if (table === 'user_plan_assignments') return { select: () => chain(assignmentMaybeSingle) }
    if (table === 'plan_quotas') return { select: () => chain(quotaMaybeSingle) }
    if (table === 'quota_usage') return { select: () => chain(usageMaybeSingle) }
    throw new Error(`unexpected table: ${table}`)
  })
  return { fromMock, rpcMock, assignmentMaybeSingle, quotaMaybeSingle, usageMaybeSingle }
})

vi.mock('@/shared/lib/supabase', () => ({ supabase: { from: fromMock, rpc: rpcMock } }))

import { quotaService } from '@/shared/lib/quotaService'

describe('quotaService.checkQuota', () => {
  it('is not allowed when the user has no active plan assignment', async () => {
    assignmentMaybeSingle.mockResolvedValueOnce({ data: null, error: null })

    const result = await quotaService.checkQuota('user-1', 'ai_messages')

    expect(result).toEqual({ allowed: false, reason: 'No active plan found' })
    expect(fromMock).toHaveBeenCalledWith('user_plan_assignments')
  })

  it('is not allowed when the assignment lookup errors, with an honest reason distinct from "no plan" (PIP Sprint 8/10)', async () => {
    assignmentMaybeSingle.mockResolvedValueOnce({ data: null, error: new Error('boom') })

    const result = await quotaService.checkQuota('user-1', 'ai_messages')

    expect(result).toEqual({ allowed: false, reason: 'Could not verify your plan — please try again.' })
  })

  it('is not allowed when the quota lookup errors, with the same honest reason (PIP Sprint 8/10)', async () => {
    assignmentMaybeSingle.mockResolvedValueOnce({ data: { plan_id: 'plan-beta' }, error: null })
    quotaMaybeSingle.mockResolvedValueOnce({ data: null, error: new Error('boom') })

    const result = await quotaService.checkQuota('user-1', 'ai_messages')

    expect(result).toEqual({ allowed: false, reason: 'Could not verify your plan — please try again.' })
  })

  it('is not allowed when the plan has no quota configured for the key', async () => {
    assignmentMaybeSingle.mockResolvedValueOnce({ data: { plan_id: 'plan-beta' }, error: null })
    quotaMaybeSingle.mockResolvedValueOnce({ data: null, error: null })

    const result = await quotaService.checkQuota('user-1', 'unknown_key')

    expect(result).toEqual({ allowed: false, reason: 'Quota not configured' })
  })

  it('allows usage under the limit, defaulting to 0 used when no usage row exists yet this period', async () => {
    assignmentMaybeSingle.mockResolvedValueOnce({ data: { plan_id: 'plan-beta' }, error: null })
    quotaMaybeSingle.mockResolvedValueOnce({ data: { quota_limit: 1000 }, error: null })
    usageMaybeSingle.mockResolvedValueOnce({ data: null, error: null })

    const result = await quotaService.checkQuota('user-1', 'ai_messages')

    expect(result).toEqual({ allowed: true, used: 0, limit: 1000 })
  })

  it('allows usage strictly below the limit', async () => {
    assignmentMaybeSingle.mockResolvedValueOnce({ data: { plan_id: 'plan-free' }, error: null })
    quotaMaybeSingle.mockResolvedValueOnce({ data: { quota_limit: 100 }, error: null })
    usageMaybeSingle.mockResolvedValueOnce({ data: { usage_count: 99 }, error: null })

    const result = await quotaService.checkQuota('user-1', 'ai_messages')

    expect(result).toEqual({ allowed: true, used: 99, limit: 100 })
  })

  it('denies usage at the limit', async () => {
    assignmentMaybeSingle.mockResolvedValueOnce({ data: { plan_id: 'plan-free' }, error: null })
    quotaMaybeSingle.mockResolvedValueOnce({ data: { quota_limit: 100 }, error: null })
    usageMaybeSingle.mockResolvedValueOnce({ data: { usage_count: 100 }, error: null })

    const result = await quotaService.checkQuota('user-1', 'ai_messages')

    expect(result).toEqual({ allowed: false, used: 100, limit: 100 })
  })

  it('denies usage over the limit', async () => {
    assignmentMaybeSingle.mockResolvedValueOnce({ data: { plan_id: 'plan-free' }, error: null })
    quotaMaybeSingle.mockResolvedValueOnce({ data: { quota_limit: 100 }, error: null })
    usageMaybeSingle.mockResolvedValueOnce({ data: { usage_count: 150 }, error: null })

    const result = await quotaService.checkQuota('user-1', 'ai_messages')

    expect(result).toEqual({ allowed: false, used: 150, limit: 100 })
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
