import { describe, expect, it, vi } from 'vitest'

const { rpcMock, functionsInvokeMock } = vi.hoisted(() => ({ rpcMock: vi.fn(), functionsInvokeMock: vi.fn() }))
vi.mock('@/shared/lib/supabase', () => ({ supabase: { rpc: rpcMock, functions: { invoke: functionsInvokeMock } } }))

import {
  adminAiUsageSummary,
  adminChangeUserPlan,
  adminCreateBetaInvite,
  adminListBetaInvites,
  adminListUsers,
  adminPlatformCounts,
  adminResetUserQuota,
  adminRevokeBetaInvite,
  adminSetPlatformProviderSetting,
  adminSetUserDisabled,
  adminUpdatePlanQuota,
  sendBetaInvitationEmail,
} from '@/modules/admin/api/adminApi'

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

  it('adminChangeUserPlan forwards user and plan ids to the RPC', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null })

    await adminChangeUserPlan({ userId: 'user-1', planId: 'plan-pro' })

    expect(rpcMock).toHaveBeenCalledWith('admin_change_user_plan', { p_user_id: 'user-1', p_plan_id: 'plan-pro' })
  })

  it('adminChangeUserPlan throws on error — a non-admin caller must see the failure', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: new Error('Not authorized') })

    await expect(adminChangeUserPlan({ userId: 'user-1', planId: 'plan-pro' })).rejects.toThrow('Not authorized')
  })

  it('adminResetUserQuota forwards user id and quota key to the RPC', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null })

    await adminResetUserQuota({ userId: 'user-1', quotaKey: 'ai_messages' })

    expect(rpcMock).toHaveBeenCalledWith('admin_reset_user_quota', { p_user_id: 'user-1', p_quota_key: 'ai_messages' })
  })

  it('adminSetUserDisabled forwards user id and the disabled flag to the RPC', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null })

    await adminSetUserDisabled({ userId: 'user-1', disabled: true })

    expect(rpcMock).toHaveBeenCalledWith('admin_set_user_disabled', { p_user_id: 'user-1', p_disabled: true })
  })

  it('adminSetUserDisabled throws when the RPC rejects self-disable', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: new Error('Cannot disable your own account') })

    await expect(adminSetUserDisabled({ userId: 'founder-1', disabled: true })).rejects.toThrow('Cannot disable your own account')
  })

  it('adminSetPlatformProviderSetting forwards provider id, enabled, and priority to the RPC', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null })

    await adminSetPlatformProviderSetting({ providerId: 'openai', enabled: false, priority: 5 })

    expect(rpcMock).toHaveBeenCalledWith('admin_set_platform_provider_setting', {
      p_provider_id: 'openai',
      p_enabled: false,
      p_priority: 5,
    })
  })

  it('adminAiUsageSummary calls the RPC without args by default and returns its rows', async () => {
    rpcMock.mockResolvedValueOnce({ data: [{ provider: 'anthropic', request_count: 10, error_count: 1, avg_latency_ms: 250 }], error: null })

    const result = await adminAiUsageSummary()

    expect(rpcMock).toHaveBeenCalledWith('admin_ai_usage_summary', undefined)
    expect(result).toEqual([{ provider: 'anthropic', request_count: 10, error_count: 1, avg_latency_ms: 250 }])
  })

  it('adminAiUsageSummary passes an explicit since timestamp through', async () => {
    rpcMock.mockResolvedValueOnce({ data: [], error: null })

    await adminAiUsageSummary('2026-01-01T00:00:00.000Z')

    expect(rpcMock).toHaveBeenCalledWith('admin_ai_usage_summary', { p_since: '2026-01-01T00:00:00.000Z' })
  })

  it('adminPlatformCounts returns the single summary row', async () => {
    rpcMock.mockResolvedValueOnce({ data: [{ documents: 3, conversations: 1, notes: 2, knowledge_collections: 0 }], error: null })

    const result = await adminPlatformCounts()

    expect(result).toEqual({ documents: 3, conversations: 1, notes: 2, knowledge_collections: 0 })
  })

  it('adminPlatformCounts falls back to zeroed counts if the RPC returns no row', async () => {
    rpcMock.mockResolvedValueOnce({ data: [], error: null })

    const result = await adminPlatformCounts()

    expect(result).toEqual({ documents: 0, conversations: 0, notes: 0, knowledge_collections: 0 })
  })

  it('adminUpdatePlanQuota forwards plan id, quota key, and new limit to the RPC', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null })

    await adminUpdatePlanQuota({ planId: 'plan-pro', quotaKey: 'ai_messages', quotaLimit: 5000 })

    expect(rpcMock).toHaveBeenCalledWith('admin_update_plan_quota', {
      p_plan_id: 'plan-pro',
      p_quota_key: 'ai_messages',
      p_quota_limit: 5000,
    })
  })

  describe('sendBetaInvitationEmail', () => {
    it('invokes the edge function with only the invite id and returns no error on success', async () => {
      functionsInvokeMock.mockResolvedValueOnce({ data: { sent: true }, error: null })

      const result = await sendBetaInvitationEmail('invite-1')

      expect(functionsInvokeMock).toHaveBeenCalledWith('send-beta-invitation', { body: { inviteId: 'invite-1' } })
      expect(result).toEqual({ error: null })
    })

    it('returns the error message rather than throwing when the provider rejects the send', async () => {
      functionsInvokeMock.mockResolvedValueOnce({ data: null, error: new Error('Email provider error: 502 upstream failure') })

      const result = await sendBetaInvitationEmail('invite-1')

      expect(result).toEqual({ error: 'Email provider error: 502 upstream failure' })
    })

    it('surfaces a 409 for an already-accepted invite as an error, not a throw', async () => {
      functionsInvokeMock.mockResolvedValueOnce({ data: null, error: new Error('Invite is no longer pending (accepted)') })

      const result = await sendBetaInvitationEmail('invite-1')

      expect(result.error).toMatch(/no longer pending/)
    })
  })
})
