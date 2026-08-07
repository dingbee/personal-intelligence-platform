import { describe, expect, it, vi } from 'vitest'

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }))
vi.mock('@/shared/lib/supabase', () => ({ supabase: { rpc: rpcMock } }))

import { adminCreateBetaInvite, adminListBetaInvites, adminListUsers, adminRevokeBetaInvite } from '@/modules/admin/api/adminApi'

describe('adminApi', () => {
  it('adminListUsers calls the RPC and returns its rows', async () => {
    rpcMock.mockResolvedValueOnce({ data: [{ id: 'user-1', email: 'a@x.com' }], error: null })

    const result = await adminListUsers()

    expect(rpcMock).toHaveBeenCalledWith('admin_list_users')
    expect(result).toEqual([{ id: 'user-1', email: 'a@x.com' }])
  })

  it('adminListUsers throws on error — a non-admin caller must see the failure, not an empty list', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: new Error('Not authorized') })

    await expect(adminListUsers()).rejects.toThrow('Not authorized')
  })

  it('adminListBetaInvites calls the RPC', async () => {
    rpcMock.mockResolvedValueOnce({ data: [], error: null })

    await adminListBetaInvites()

    expect(rpcMock).toHaveBeenCalledWith('admin_list_beta_invites')
  })

  it('adminCreateBetaInvite normalizes optional fields to null and forwards the exact param names the RPC expects', async () => {
    rpcMock.mockResolvedValueOnce({ data: [{ outcome: 'created', invite_id: 'invite-1' }], error: null })

    const result = await adminCreateBetaInvite({ email: 'new@x.com' })

    expect(rpcMock).toHaveBeenCalledWith('admin_create_beta_invite', {
      p_email: 'new@x.com',
      p_full_name: null,
      p_organization: null,
      p_plan_id: null,
    })
    expect(result).toEqual({ outcome: 'created', invite_id: 'invite-1' })
  })

  it('adminCreateBetaInvite surfaces a duplicate outcome without throwing', async () => {
    rpcMock.mockResolvedValueOnce({ data: [{ outcome: 'duplicate', invite_id: null }], error: null })

    const result = await adminCreateBetaInvite({ email: 'existing@x.com' })

    expect(result.outcome).toBe('duplicate')
  })

  it('adminRevokeBetaInvite calls the RPC with the invite id and returns its boolean result', async () => {
    rpcMock.mockResolvedValueOnce({ data: true, error: null })

    const result = await adminRevokeBetaInvite('invite-1')

    expect(rpcMock).toHaveBeenCalledWith('admin_revoke_beta_invite', { p_invite_id: 'invite-1' })
    expect(result).toBe(true)
  })
})
