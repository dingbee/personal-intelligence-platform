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

import {
  acceptFoundingProInvitation,
  getFoundingProPublicCapacity,
  getMyFoundingProMembership,
  getMyLatestFoundingProApplication,
  getMyPendingFoundingProInvitation,
  submitFoundingProApplication,
} from '@/modules/founding-pro/api/foundingPro'

describe('getFoundingProPublicCapacity', () => {
  it('normalizes the RPC row into camelCase', async () => {
    rpcMock.mockResolvedValueOnce({ data: [{ max_public_slots: 100, enrolled_public_count: 37, remaining_public_slots: 63 }], error: null })

    const result = await getFoundingProPublicCapacity()

    expect(rpcMock).toHaveBeenCalledWith('get_founding_pro_public_capacity')
    expect(result).toEqual({ maxPublicSlots: 100, enrolledPublicCount: 37, remainingPublicSlots: 63 })
  })

  it('returns null on an RPC error, never inventing a capacity figure', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: new Error('boom') })
    expect(await getFoundingProPublicCapacity()).toBeNull()
  })

  it('returns null when no row is returned', async () => {
    rpcMock.mockResolvedValueOnce({ data: [], error: null })
    expect(await getFoundingProPublicCapacity()).toBeNull()
  })
})

describe('getMyFoundingProMembership', () => {
  it('reads the caller-scoped founding_pro_members row', async () => {
    const row = { id: 'member-1', user_id: 'user-1' }
    fromMock.mockImplementation((table: string) => {
      if (table === 'founding_pro_members') {
        return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: row, error: null }) }) }) }
      }
      throw new Error(`unexpected table: ${table}`)
    })

    expect(await getMyFoundingProMembership('user-1')).toEqual(row)
  })

  it('returns null (not throw) on a query error', async () => {
    fromMock.mockImplementation(() => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: new Error('boom') }) }) }) }))
    expect(await getMyFoundingProMembership('user-1')).toBeNull()
  })
})

describe('getMyLatestFoundingProApplication', () => {
  it('orders by submitted_at descending and limits to 1', async () => {
    const row = { id: 'app-1', user_id: 'user-1', status: 'pending' }
    const limitMock = vi.fn(() => ({ maybeSingle: () => Promise.resolve({ data: row, error: null }) }))
    const orderMock = vi.fn(() => ({ limit: limitMock }))
    fromMock.mockImplementation((table: string) => {
      if (table === 'founding_pro_applications') {
        return { select: () => ({ eq: () => ({ order: orderMock }) }) }
      }
      throw new Error(`unexpected table: ${table}`)
    })

    const result = await getMyLatestFoundingProApplication('user-1')

    expect(result).toEqual(row)
    expect(orderMock).toHaveBeenCalledWith('submitted_at', { ascending: false })
    expect(limitMock).toHaveBeenCalledWith(1)
  })
})

describe('submitFoundingProApplication', () => {
  it('calls the submission RPC with no arguments and normalizes the result', async () => {
    rpcMock.mockResolvedValueOnce({ data: { application_id: 'app-1', status: 'pending' }, error: null })

    const result = await submitFoundingProApplication()

    expect(rpcMock).toHaveBeenCalledWith('submit_founding_pro_application')
    expect(result).toEqual({ applicationId: 'app-1', status: 'pending' })
  })

  it('throws the server error rather than swallowing it, so the UI can surface the real reason', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: new Error('You already have an active Founding Pro application') })

    await expect(submitFoundingProApplication()).rejects.toThrow('You already have an active Founding Pro application')
  })

  it('throws if the RPC returns no data', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null })
    await expect(submitFoundingProApplication()).rejects.toThrow('did not return a result')
  })

  it('throws if the RPC returns an unexpected shape', async () => {
    rpcMock.mockResolvedValueOnce({ data: { unexpected: true }, error: null })
    await expect(submitFoundingProApplication()).rejects.toThrow('unexpected result')
  })
})

describe('getMyPendingFoundingProInvitation', () => {
  it('reads the caller-scoped pending founding_pro_invitations row', async () => {
    const row = { id: 'invitation-1', user_id: 'user-1', status: 'pending', founding_price_cents: 1999, currency: 'USD' }
    const eqStatusMock = vi.fn(() => ({ maybeSingle: () => Promise.resolve({ data: row, error: null }) }))
    fromMock.mockImplementation((table: string) => {
      if (table === 'founding_pro_invitations') {
        return { select: () => ({ eq: () => ({ eq: eqStatusMock }) }) }
      }
      throw new Error(`unexpected table: ${table}`)
    })

    expect(await getMyPendingFoundingProInvitation('user-1')).toEqual(row)
    expect(eqStatusMock).toHaveBeenCalledWith('status', 'pending')
  })

  it('returns null (not throw) on a query error', async () => {
    fromMock.mockImplementation(() => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: new Error('boom') }) }) }) }) }))
    expect(await getMyPendingFoundingProInvitation('user-1')).toBeNull()
  })
})

describe('acceptFoundingProInvitation', () => {
  it('calls the acceptance RPC with no arguments and normalizes the result', async () => {
    rpcMock.mockResolvedValueOnce({ data: { outcome: 'enrolled', member_id: 'member-1', founding_member_number: 7 }, error: null })

    const result = await acceptFoundingProInvitation()

    expect(rpcMock).toHaveBeenCalledWith('accept_founding_pro_invitation')
    expect(result).toEqual({ memberId: 'member-1', foundingMemberNumber: 7 })
  })

  it('normalizes a grandfathered-shaped result (no member number) to null, not undefined', async () => {
    rpcMock.mockResolvedValueOnce({ data: { outcome: 'enrolled', member_id: 'member-1', founding_member_number: null }, error: null })

    const result = await acceptFoundingProInvitation()

    expect(result).toEqual({ memberId: 'member-1', foundingMemberNumber: null })
  })

  it('throws the server error rather than swallowing it, so the acceptance page can surface the real reason', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: new Error('No pending Founding Pro invitation found for this account') })

    await expect(acceptFoundingProInvitation()).rejects.toThrow('No pending Founding Pro invitation found for this account')
  })

  it('throws if the RPC returns no data', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null })
    await expect(acceptFoundingProInvitation()).rejects.toThrow('did not return a result')
  })

  it('throws if the RPC returns an unexpected shape', async () => {
    rpcMock.mockResolvedValueOnce({ data: { unexpected: true }, error: null })
    await expect(acceptFoundingProInvitation()).rejects.toThrow('unexpected result')
  })
})
