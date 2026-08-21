import { describe, expect, it, vi } from 'vitest'
import { FunctionsHttpError } from '@supabase/supabase-js'

const { rpcMock, functionsInvokeMock } = vi.hoisted(() => ({ rpcMock: vi.fn(), functionsInvokeMock: vi.fn() }))
vi.mock('@/shared/lib/supabase', () => ({ supabase: { rpc: rpcMock, functions: { invoke: functionsInvokeMock } } }))

import {
  adminAcknowledgeSystemHealthEvent,
  adminAiUsageSummary,
  adminChangeUserPlan,
  adminCommercialOverview,
  adminCreateBetaInvite,
  adminGetUserQuotaBreakdown,
  adminIgnoreSystemHealthEvent,
  adminListBetaInvites,
  adminListSubscriptionEvents,
  adminListSubscriptions,
  adminListSystemHealthEvents,
  adminListUsers,
  adminPlanQuotaPopulation,
  adminPlatformCounts,
  adminRemoveUserQuotaOverride,
  adminReopenSystemHealthEvent,
  adminResetUserQuota,
  adminResolveSystemHealthEvent,
  adminRevokeBetaInvite,
  adminSetPlatformProviderSetting,
  adminSetUserDisabled,
  adminSetUserQuotaOverride,
  adminSystemHealthSummary,
  adminUpdatePlanQuota,
  adminUsageOverview,
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

  /**
   * #21 Phase 4.3 — Admin Billing & Subscription Operations. Every function
   * here is read-only (see adminApi.ts's own header comment on this
   * section) — there is deliberately no test for a client-side subscription
   * mutation, because no such call site exists.
   */
  describe('admin billing/subscription reads', () => {
    it('adminListSubscriptions defaults every filter to null and forwards the default limit', async () => {
      rpcMock.mockResolvedValueOnce({ data: [{ user_id: 'user-1', plan_code: 'pro' }], error: null })

      const result = await adminListSubscriptions()

      expect(rpcMock).toHaveBeenCalledWith('admin_list_subscriptions', { p_status: null, p_plan_code: null, p_limit: 500 })
      expect(result).toEqual([{ user_id: 'user-1', plan_code: 'pro' }])
    })

    it('adminListSubscriptions forwards explicit status/plan filters', async () => {
      rpcMock.mockResolvedValueOnce({ data: [], error: null })

      await adminListSubscriptions({ status: 'past_due', planCode: 'student' })

      expect(rpcMock).toHaveBeenCalledWith('admin_list_subscriptions', { p_status: 'past_due', p_plan_code: 'student', p_limit: 500 })
    })

    it('adminListSubscriptions throws on error — a non-admin caller must see the failure, not an empty list', async () => {
      rpcMock.mockResolvedValueOnce({ data: null, error: new Error('Not authorized') })

      await expect(adminListSubscriptions()).rejects.toThrow('Not authorized')
    })

    it('adminListSubscriptionEvents defaults processingStatus to null', async () => {
      rpcMock.mockResolvedValueOnce({ data: [{ id: 'evt-1', processing_status: 'failed' }], error: null })

      const result = await adminListSubscriptionEvents()

      expect(rpcMock).toHaveBeenCalledWith('admin_list_subscription_events', { p_processing_status: null, p_limit: 200 })
      expect(result).toEqual([{ id: 'evt-1', processing_status: 'failed' }])
    })

    it('adminListSubscriptionEvents forwards an explicit processingStatus filter, so "billing inconsistencies" can be isolated', async () => {
      rpcMock.mockResolvedValueOnce({ data: [], error: null })

      await adminListSubscriptionEvents({ processingStatus: 'failed' })

      expect(rpcMock).toHaveBeenCalledWith('admin_list_subscription_events', { p_processing_status: 'failed', p_limit: 200 })
    })

    it('adminCommercialOverview calls the RPC and falls back to an empty object if no data is returned', async () => {
      rpcMock.mockResolvedValueOnce({ data: null, error: null })

      const result = await adminCommercialOverview()

      expect(rpcMock).toHaveBeenCalledWith('admin_commercial_overview')
      expect(result).toEqual({})
    })
  })

  /**
   * #21 Phase 4.4 — Admin Usage & Quota Operations reads. Overrides
   * themselves are still exercised by the existing
   * adminSetUserQuotaOverride/adminRemoveUserQuotaOverride tests above —
   * this only covers the new read views across every quota key.
   */
  describe('admin usage/quota reads', () => {
    it('adminGetUserQuotaBreakdown forwards exactly the target user id', async () => {
      rpcMock.mockResolvedValueOnce({
        data: [{ quota_key: 'ai_messages', plan_limit: 500, override_limit: null, effective_limit: 500, usage_count: 10, percent_used: 2 }],
        error: null,
      })

      const result = await adminGetUserQuotaBreakdown('user-a')

      expect(rpcMock).toHaveBeenCalledWith('admin_get_user_quota_breakdown', { p_user_id: 'user-a' })
      expect(result).toHaveLength(1)
    })

    it('adminGetUserQuotaBreakdown throws on error', async () => {
      rpcMock.mockResolvedValueOnce({ data: null, error: new Error('Not authorized') })

      await expect(adminGetUserQuotaBreakdown('user-a')).rejects.toThrow('Not authorized')
    })

    it('adminPlanQuotaPopulation calls the RPC with no args', async () => {
      rpcMock.mockResolvedValueOnce({ data: [], error: null })

      await adminPlanQuotaPopulation()

      expect(rpcMock).toHaveBeenCalledWith('admin_plan_quota_population')
    })

    it('adminUsageOverview calls the RPC and falls back to an empty object if no data is returned', async () => {
      rpcMock.mockResolvedValueOnce({ data: null, error: null })

      const result = await adminUsageOverview()

      expect(rpcMock).toHaveBeenCalledWith('admin_usage_overview')
      expect(result).toEqual({})
    })
  })

  /**
   * #21 Phase 5 — Unified Admin Intelligence / Error Centre. Every action
   * RPC is asserted to forward exactly the target event id — proving a
   * single-event action can never carry a different event's id (same
   * discipline as adminSetUserQuotaOverride's own test above).
   */
  describe('admin system health events', () => {
    it('adminListSystemHealthEvents forwards every filter, defaulting absent ones to null and the limit to 200', async () => {
      rpcMock.mockResolvedValueOnce({ data: [], error: null })

      await adminListSystemHealthEvents({ category: 'billing', status: 'open' })

      expect(rpcMock).toHaveBeenCalledWith('admin_list_system_health_events', {
        p_category: 'billing',
        p_severity: null,
        p_status: 'open',
        p_since: null,
        p_user_id: null,
        p_operation: null,
        p_provider: null,
        p_limit: 200,
      })
    })

    it('adminListSystemHealthEvents throws on error — a non-admin caller must see the failure, not an empty list', async () => {
      rpcMock.mockResolvedValueOnce({ data: null, error: new Error('Not authorized') })

      await expect(adminListSystemHealthEvents()).rejects.toThrow('Not authorized')
    })

    it('adminSystemHealthSummary calls the RPC and falls back to an empty object', async () => {
      rpcMock.mockResolvedValueOnce({ data: null, error: null })

      const result = await adminSystemHealthSummary()

      expect(rpcMock).toHaveBeenCalledWith('admin_system_health_summary')
      expect(result).toEqual({})
    })

    it('adminAcknowledgeSystemHealthEvent forwards exactly the target event id', async () => {
      rpcMock.mockResolvedValueOnce({ data: { id: 'evt-1', status: 'acknowledged' }, error: null })

      const result = await adminAcknowledgeSystemHealthEvent('evt-1')

      expect(rpcMock).toHaveBeenCalledWith('admin_acknowledge_system_health_event', { p_event_id: 'evt-1' })
      expect(result).toEqual({ id: 'evt-1', status: 'acknowledged' })
    })

    it('adminAcknowledgeSystemHealthEvent throws when the event is not open', async () => {
      rpcMock.mockResolvedValueOnce({ data: null, error: new Error('Event must be open to acknowledge (current status: resolved)') })

      await expect(adminAcknowledgeSystemHealthEvent('evt-1')).rejects.toThrow('Event must be open to acknowledge')
    })

    it('adminResolveSystemHealthEvent forwards the event id and an optional resolution note, defaulting to null', async () => {
      rpcMock.mockResolvedValueOnce({ data: { id: 'evt-1', status: 'resolved' }, error: null })

      await adminResolveSystemHealthEvent({ eventId: 'evt-1' })

      expect(rpcMock).toHaveBeenCalledWith('admin_resolve_system_health_event', { p_event_id: 'evt-1', p_resolution_note: null })
    })

    it('adminResolveSystemHealthEvent forwards an explicit resolution note', async () => {
      rpcMock.mockResolvedValueOnce({ data: { id: 'evt-1', status: 'resolved' }, error: null })

      await adminResolveSystemHealthEvent({ eventId: 'evt-1', resolutionNote: 'Retried and confirmed fixed.' })

      expect(rpcMock).toHaveBeenCalledWith('admin_resolve_system_health_event', {
        p_event_id: 'evt-1',
        p_resolution_note: 'Retried and confirmed fixed.',
      })
    })

    it('adminReopenSystemHealthEvent forwards exactly the target event id', async () => {
      rpcMock.mockResolvedValueOnce({ data: { id: 'evt-1', status: 'open' }, error: null })

      await adminReopenSystemHealthEvent('evt-1')

      expect(rpcMock).toHaveBeenCalledWith('admin_reopen_system_health_event', { p_event_id: 'evt-1' })
    })

    it('adminReopenSystemHealthEvent throws when the event is already open', async () => {
      rpcMock.mockResolvedValueOnce({ data: null, error: new Error('Event must be resolved or ignored to reopen (current status: open)') })

      await expect(adminReopenSystemHealthEvent('evt-1')).rejects.toThrow('Event must be resolved or ignored to reopen')
    })

    it('adminIgnoreSystemHealthEvent forwards exactly the target event id', async () => {
      rpcMock.mockResolvedValueOnce({ data: { id: 'evt-1', status: 'ignored' }, error: null })

      await adminIgnoreSystemHealthEvent('evt-1')

      expect(rpcMock).toHaveBeenCalledWith('admin_ignore_system_health_event', { p_event_id: 'evt-1' })
    })
  })
})
