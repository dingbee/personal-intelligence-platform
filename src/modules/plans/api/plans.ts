import { supabase } from '@/shared/lib/supabase'

export interface CurrentUserPlan {
  planId: string
  planCode: string
  planName: string
}

/**
 * Resolves the caller's own active plan code/name — quotaService.ts only
 * ever needed `plan_id` (to join into plan_quotas for a limit), so this is
 * the one piece of "what plan am I actually on" resolution the app never
 * had before provider entitlements needed it. RLS on both tables is
 * SELECT-only-own-row/public-read respectively (0034_beta_invite_quota_
 * repair.sql), so this never needs to go through an RPC.
 */
export async function getCurrentUserPlan(userId: string): Promise<CurrentUserPlan | null> {
  const { data: assignment } = await supabase
    .from('user_plan_assignments')
    .select('plan_id')
    .eq('user_id', userId)
    .eq('active', true)
    .maybeSingle()

  if (!assignment) return null

  const { data: plan } = await supabase.from('plans').select('id, code, name').eq('id', assignment.plan_id).maybeSingle()

  if (!plan) return null

  return { planId: plan.id, planCode: plan.code, planName: plan.name }
}

/**
 * Phase 4 Commercial Architecture — thin client wrapper over the
 * `has_feature` RPC (0046_feature_entitlements_and_storage_quota.sql).
 * Unlike `canSelectProvider` (a hardcoded plan-code check, safe only
 * because it gates no real privilege), collaboration IS a real,
 * server-enforced boundary — `invite_to_workspace` independently re-checks
 * this same `has_feature` resolution before granting an invite, so a
 * client-side hardcoded guess here could drift from what the database
 * would actually allow (e.g. an admin-adjusted plan_quotas row). This
 * always asks the database, the same source of truth the enforcement
 * point uses, so the UI's "can I invite someone" hint can never promise
 * more than the server will honor.
 */
export async function hasFeature(userId: string, featureKey: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('has_feature', { p_user_id: userId, p_feature_key: featureKey })
  if (error) {
    console.error('hasFeature: resolution failed:', error)
    return false
  }
  return data ?? false
}

/**
 * Phase 4 — storage is a real quantitative quota (plan_quotas'
 * `storage_bytes` key), resolved through the exact same
 * `resolve_effective_quota_limit` RPC `quotaService.checkQuota` already
 * uses for `ai_messages` — no second resolution path. `calculate_user_-
 * storage_usage` sums `documents.file_size` + `assets.size_bytes` live
 * (see 0046's own comment for why storage isn't tracked incrementally in
 * `quota_usage`). Returns `null` limit when no plan/quota is configured,
 * mirroring `resolve_effective_quota_limit`'s own null-means-unresolved
 * contract rather than treating it as unlimited.
 */
export async function getStorageUsage(userId: string): Promise<{ used: number; limit: number | null }> {
  const [{ data: used, error: usedError }, { data: limit, error: limitError }] = await Promise.all([
    supabase.rpc('calculate_user_storage_usage', { p_user_id: userId }),
    supabase.rpc('resolve_effective_quota_limit', { p_user_id: userId, p_quota_key: 'storage_bytes' }),
  ])
  if (usedError) console.error('getStorageUsage: usage calculation failed:', usedError)
  if (limitError) console.error('getStorageUsage: limit resolution failed:', limitError)
  return { used: used ?? 0, limit: limit ?? null }
}
