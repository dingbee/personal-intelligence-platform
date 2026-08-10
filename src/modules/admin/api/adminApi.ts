import { supabase } from '@/shared/lib/supabase'

/** Every function here calls a SECURITY DEFINER RPC that re-checks is_platform_admin() itself and raises if the caller isn't one — the authorization is enforced by the database, this file is a thin, unprivileged wrapper. */

export async function adminListUsers() {
  const { data, error } = await supabase.rpc('admin_list_users')
  if (error) throw error
  return data ?? []
}

export async function adminListBetaInvites() {
  const { data, error } = await supabase.rpc('admin_list_beta_invites')
  if (error) throw error
  return data ?? []
}

export async function adminCreateBetaInvite(params: {
  email: string
  fullName?: string | null
  organization?: string | null
  planId?: string | null
}) {
  const { data, error } = await supabase.rpc('admin_create_beta_invite', {
    p_email: params.email,
    p_full_name: params.fullName ?? null,
    p_organization: params.organization ?? null,
    p_plan_id: params.planId ?? null,
  })
  if (error) throw error
  return data?.[0] ?? { outcome: 'duplicate' as const, invite_id: null }
}

export async function adminRevokeBetaInvite(inviteId: string) {
  const { data, error } = await supabase.rpc('admin_revoke_beta_invite', { p_invite_id: inviteId })
  if (error) throw error
  return data ?? false
}

/**
 * PIP Stabilization v1 (P1) — invokes the send-beta-invitation edge
 * function, mirroring sendWorkspaceInvitationEmail's own shape exactly:
 * takes only the invite id, never email/name, so the function re-resolves
 * everything itself from the database rather than trusting client state.
 * `supabase.functions.invoke` forwards the caller's own session JWT
 * automatically — never a service-role key, which only exists server-side.
 * Returns `{ error }` rather than throwing so the invite-creation flow can
 * treat "invite created, email failed" as a distinct, non-corrupting
 * outcome from "invite creation itself failed" — the database row is
 * unaffected either way.
 */
export async function sendBetaInvitationEmail(inviteId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.functions.invoke('send-beta-invitation', { body: { inviteId } })
  return { error: error ? error.message : null }
}

export async function adminChangeUserPlan(params: { userId: string; planId: string }) {
  const { error } = await supabase.rpc('admin_change_user_plan', { p_user_id: params.userId, p_plan_id: params.planId })
  if (error) throw error
}

export async function adminResetUserQuota(params: { userId: string; quotaKey: string }) {
  const { error } = await supabase.rpc('admin_reset_user_quota', { p_user_id: params.userId, p_quota_key: params.quotaKey })
  if (error) throw error
}

export async function adminSetUserDisabled(params: { userId: string; disabled: boolean }) {
  const { error } = await supabase.rpc('admin_set_user_disabled', { p_user_id: params.userId, p_disabled: params.disabled })
  if (error) throw error
}

export async function adminSetPlatformProviderSetting(params: { providerId: string; enabled: boolean; priority: number }) {
  const { error } = await supabase.rpc('admin_set_platform_provider_setting', {
    p_provider_id: params.providerId,
    p_enabled: params.enabled,
    p_priority: params.priority,
  })
  if (error) throw error
}

export async function adminAiUsageSummary(sinceIso?: string) {
  const { data, error } = await supabase.rpc('admin_ai_usage_summary', sinceIso ? { p_since: sinceIso } : undefined)
  if (error) throw error
  return data ?? []
}

export async function adminPlatformCounts() {
  const { data, error } = await supabase.rpc('admin_platform_counts')
  if (error) throw error
  return data?.[0] ?? { documents: 0, conversations: 0, notes: 0, knowledge_collections: 0 }
}

export async function adminUpdatePlanQuota(params: { planId: string; quotaKey: string; quotaLimit: number }) {
  const { error } = await supabase.rpc('admin_update_plan_quota', {
    p_plan_id: params.planId,
    p_quota_key: params.quotaKey,
    p_quota_limit: params.quotaLimit,
  })
  if (error) throw error
}

/** Sets or replaces a per-user quota override — affects only this user_id + quota_key, never plan_quotas or any other user's row. See 0041_user_quota_overrides.sql. */
export async function adminSetUserQuotaOverride(params: { userId: string; quotaKey: string; quotaLimit: number }) {
  const { error } = await supabase.rpc('admin_set_user_quota_override', {
    p_user_id: params.userId,
    p_quota_key: params.quotaKey,
    p_quota_limit: params.quotaLimit,
  })
  if (error) throw error
}

/** Removes a per-user quota override, reverting that user to their plan's default limit. */
export async function adminRemoveUserQuotaOverride(params: { userId: string; quotaKey: string }) {
  const { error } = await supabase.rpc('admin_remove_user_quota_override', {
    p_user_id: params.userId,
    p_quota_key: params.quotaKey,
  })
  if (error) throw error
}

/**
 * Phase 5A — sets a plan's allocation for one AI provider (active + admin-
 * configured priority/order). Provider identity is never hardcoded into
 * any plan-entitlement logic — this just writes a (plan_id, provider_id)
 * row; the caller supplies whichever provider_id the client-side registry
 * currently knows about.
 */
export async function adminSetPlanAiProvider(params: { planId: string; providerId: string; active: boolean; priority: number }) {
  const { error } = await supabase.rpc('admin_set_plan_ai_provider', {
    p_plan_id: params.planId,
    p_provider_id: params.providerId,
    p_active: params.active,
    p_priority: params.priority,
  })
  if (error) throw error
}

/** Phase 5A — pricing metadata + active flag on `plans`. Configuration/data only; never read by entitlement or quota logic. */
export async function adminUpdatePlanCommercial(params: {
  planId: string
  monthlyPriceCents: number | null
  annualPriceCents: number | null
  currency: string
  active: boolean
}) {
  const { error } = await supabase.rpc('admin_update_plan_commercial', {
    p_plan_id: params.planId,
    p_monthly_price_cents: params.monthlyPriceCents,
    p_annual_price_cents: params.annualPriceCents,
    p_currency: params.currency,
    p_active: params.active,
  })
  if (error) throw error
}
