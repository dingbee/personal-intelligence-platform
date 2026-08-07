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
