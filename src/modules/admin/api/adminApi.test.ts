import { describe, expect, it, vi } from 'vitest'
import { FunctionsHttpError } from '@supabase/supabase-js'

const { rpcMock, functionsInvokeMock } = vi.hoisted(() => ({ rpcMock: vi.fn(), functionsInvokeMock: vi.fn() }))
vi.mock('@/shared/lib/supabase', () => ({ supabase: { rpc: rpcMock, functions: { invoke: functionsInvokeMock } } }))

import {
  adminAiUsageSummary,
  adminChangeUserPlan,
  adminCreateBetaInvite,
  adminListBetaInvites,
  adminListUsers,
  adminPlatformCounts,
  adminRemoveUserQuotaOverride,
  adminResetUserQuota,
  adminRevokeBetaInvite,
  adminSetPlatformProviderSetting,
  adminSetUserDisabled,
  adminSetUserQuotaOverride,
  adminUpdatePlanQuota,
  sendBetaInvitationEmail,
  sendFoundingProInvitationEmail,
} from '@/modules/admin/api/adminApi'

/**
 * P1-3 — a real `FunctionsHttpError` (thrown by `@supabase/functions-js`
 * for any non-2xx response) carries the raw `Response` on `.context`, not
 * a pre-parsed body. `jsonBody` fakes just enough of that `Response` shape
 * (`.json()`) for `extractEdgeFunctionErrorMessage` to read from, without
 * needing a real fetch Response in this test environment — same helper
 * shape as workspaceMembers.test.ts's own `fakeHttpError`.
 */
function fakeHttpError(jsonBody: unknown | (() => Promise<unknown>)): FunctionsHttpError {
  const context = {
    json: () => (typeof jsonBody === 'function' ? (jsonBody as () => Promise<unknown>)() : Promise.resolve(jsonBody)),
  }
  return new FunctionsHttpError(context as unknown as Response)
}

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

  it('adminSetUserQuotaOverride forwards exactly the target user id, quota key, and limit — proving a single-user call can never carry another user\'s id', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null })

    await adminSetUserQuotaOverride({ userId: 'user-a', quotaKey: 'ai_messages', quotaLimit: 250 })

    expect(rpcMock).toHaveBeenCalledWith('admin_set_user_quota_override', {
      p_user_id: 'user-a',
      p_quota_key: 'ai_messages',
      p_quota_limit: 250,
    })
    expect(rpcMock).not.toHaveBeenCalledWith('admin_set_user_quota_override', expect.objectContaining({ p_user_id: 'user-b' }))
  })

  it('adminSetUserQuotaOverride throws on error — a failed save must never be reported as success', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: new Error('Not authorized') })

    await expect(adminSetUserQuotaOverride({ userId: 'user-a', quotaKey: 'ai_messages', quotaLimit: 250 })).rejects.toThrow(
      'Not authorized',
    )
  })

  it('adminRemoveUserQuotaOverride forwards exactly the target user id and quota key', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null })

    await adminRemoveUserQuotaOverride({ userId: 'user-a', quotaKey: 'ai_messages' })

    expect(rpcMock).toHaveBeenCalledWith('admin_remove_user_quota_override', { p_user_id: 'user-a', p_quota_key: 'ai_messages' })
  })

  it('adminRemoveUserQuotaOverride throws on error', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: new Error('Not authorized') })

    await expect(adminRemoveUserQuotaOverride({ userId: 'user-a', quotaKey: 'ai_messages' })).rejects.toThrow('Not authorized')
  })

  describe('sendBetaInvitationEmail', () => {
    it('invokes the edge function with only the invite id and returns no error on success', async () => {
      functionsInvokeMock.mockResolvedValueOnce({ data: { sent: true }, error: null })

      const result = await sendBetaInvitationEmail('invite-1')

      expect(functionsInvokeMock).toHaveBeenCalledWith('send-beta-invitation', { body: { inviteId: 'invite-1' } })
      expect(result).toEqual({ error: null })
    })

    // P1-3 — a real `supabase.functions.invoke()` failure is a
    // FunctionsHttpError, not a plain Error: the real diagnostic text lives
    // in the response body (`.context`), reachable exactly once, not in
    // `.message` (always the generic SDK string). These three replace the
    // prior plain-Error mocks, which didn't reflect actual SDK behavior.
    it('reads the real diagnostic reason out of a structured FunctionsHttpError response body, instead of the generic SDK message', async () => {
      functionsInvokeMock.mockResolvedValueOnce({
        data: null,
        error: fakeHttpError({ error: 'Email provider error: 502 upstream failure' }),
      })

      const result = await sendBetaInvitationEmail('invite-1')

      expect(result).toEqual({ error: 'Email provider error: 502 upstream failure' })
    })

    it('surfaces a 409 for an already-accepted invite as an error, not a throw', async () => {
      functionsInvokeMock.mockResolvedValueOnce({
        data: null,
        error: fakeHttpError({ error: 'Invite is no longer pending (accepted)' }),
      })

      const result = await sendBetaInvitationEmail('invite-1')

      expect(result.error).toMatch(/no longer pending/)
    })

    it('falls back to the generic SDK message when the response body is not valid JSON', async () => {
      functionsInvokeMock.mockResolvedValueOnce({
        data: null,
        error: fakeHttpError(() => Promise.reject(new Error('Unexpected token < in JSON'))),
      })

      const result = await sendBetaInvitationEmail('invite-1')

      expect(result).toEqual({ error: 'Edge Function returned a non-2xx status code' })
    })
  })

  describe('sendFoundingProInvitationEmail', () => {
    it('invokes the edge function with only the invitation id and returns no error on success', async () => {
      functionsInvokeMock.mockResolvedValueOnce({ data: { sent: true }, error: null })

      const result = await sendFoundingProInvitationEmail('invitation-1')

      expect(functionsInvokeMock).toHaveBeenCalledWith('send-founding-pro-invitation', { body: { invitationId: 'invitation-1' } })
      expect(result).toEqual({ error: null })
    })

    it('reads the real diagnostic reason out of a structured FunctionsHttpError response body, instead of the generic SDK message', async () => {
      functionsInvokeMock.mockResolvedValueOnce({
        data: null,
        error: fakeHttpError({ error: 'Email provider error: 502 upstream failure' }),
      })

      const result = await sendFoundingProInvitationEmail('invitation-1')

      expect(result).toEqual({ error: 'Email provider error: 502 upstream failure' })
    })

    it('falls back to the generic SDK message when the response body is not valid JSON', async () => {
      functionsInvokeMock.mockResolvedValueOnce({
        data: null,
        error: fakeHttpError(() => Promise.reject(new Error('Unexpected token < in JSON'))),
      })

      const result = await sendFoundingProInvitationEmail('invitation-1')

      expect(result).toEqual({ error: 'Edge Function returned a non-2xx status code' })
    })

    it('still returns a message for a non-FunctionsHttpError rejection (e.g. a network failure)', async () => {
      functionsInvokeMock.mockResolvedValueOnce({ data: null, error: new Error('Failed to fetch') })

      const result = await sendFoundingProInvitationEmail('invitation-1')

      expect(result).toEqual({ error: 'Failed to fetch' })
    })
  })
})
