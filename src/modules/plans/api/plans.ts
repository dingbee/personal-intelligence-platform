import { supabase } from '@/shared/lib/supabase'

export interface CurrentUserPlan {
  planId: string
  planCode: string
  planName: string
}

export interface PublicPlanTier {
  planId: string
  code: string
  name: string
  description: string | null
  active: boolean
  monthlyPriceCents: number | null
  annualPriceCents: number | null
  currency: string
  aiMessagesPerMonth: number | null
  storageBytes: number | null
  collaboration: boolean
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
 * Thrown by hasFeature() when the has_feature RPC itself fails (network,
 * infra, an unexpected schema/permission error) — distinct from a
 * resolved `false`, which means the check succeeded and the caller is
 * genuinely not entitled. Every call site that gates on hasFeature()
 * already aborts if the awaited call doesn't resolve truthy; a thrown
 * EntitlementCheckFailedError propagates through that same guard, so
 * "fails closed" (see the RPC-error test in plans.test.ts) is unchanged
 * for every existing caller — nothing is ever granted on an unverifiable
 * check, before or after this type existed. What changes is that the
 * failure is no longer indistinguishable from a genuine denial: a
 * `useHasFeature` consumer can inspect `isError`/`error` on the query
 * result to tell "you're not on this plan" apart from "we couldn't check
 * right now," and every server-side capability guard (runCapability.ts,
 * each run*Intelligence.ts) now throws this instead of a generic
 * "requires an upgraded plan" message when the real cause was an
 * infrastructure failure, not a denial. Message is deliberately generic —
 * never includes the underlying Supabase error, which is logged
 * separately via console.error for diagnosis.
 */
export class EntitlementCheckFailedError extends Error {
  constructor() {
    super('We couldn’t verify your plan. Please try again.')
    this.name = 'EntitlementCheckFailedError'
  }
}

/**
 * Phase 4 Commercial Architecture — thin client wrapper over the
 * `has_feature` RPC (0046_feature_entitlements_and_storage_quota.sql).
 * Unlike a hardcoded plan-code check (safe only when it gates no real
 * privilege — see AI provider selection, which is admin-only entirely as
 * of Phase 5A rather than gated by plan code at all), collaboration IS a
 * real, server-enforced boundary — `invite_to_workspace` independently re-checks
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
    throw new EntitlementCheckFailedError()
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

/**
 * Phase 5C — the plan catalog for /pricing, driven entirely by `plans` +
 * `plan_quotas` (both authenticated-read-all, same tables
 * useAdminPlansAndQuotas reads for the admin control surface — this is
 * the read-only, non-admin-scoped counterpart). Never reads
 * `plan_ai_providers`: /pricing must never surface provider identity or
 * even provider *count*, per the locked "AI provider invisibility"
 * product decision. AI message/storage numbers shown to users always
 * come from here, not from copy hardcoded in PricingPage, so an admin
 * editing a plan's quota in Admin -> Plans & Commercial is immediately
 * reflected in what users see on /pricing.
 */
export async function getPublicPlanCatalog(codes: string[]): Promise<PublicPlanTier[]> {
  const { data: plans, error: plansError } = await supabase
    .from('plans')
    .select('id, code, name, description, active, monthly_price_cents, annual_price_cents, currency')
    .in('code', codes)
  if (plansError || !plans) {
    console.error('getPublicPlanCatalog: plans query failed:', plansError)
    return []
  }

  const { data: quotas, error: quotasError } = await supabase
    .from('plan_quotas')
    .select('plan_id, quota_key, quota_limit')
    .in(
      'plan_id',
      plans.map((p) => p.id),
    )
  if (quotasError) console.error('getPublicPlanCatalog: quotas query failed:', quotasError)

  return plans.map((plan) => {
    const planQuotas = (quotas ?? []).filter((q) => q.plan_id === plan.id)
    const aiMessages = planQuotas.find((q) => q.quota_key === 'ai_messages')
    const storage = planQuotas.find((q) => q.quota_key === 'storage_bytes')
    const collaboration = planQuotas.find((q) => q.quota_key === 'feature:collaboration')
    return {
      planId: plan.id,
      code: plan.code,
      name: plan.name,
      description: plan.description,
      active: plan.active,
      monthlyPriceCents: plan.monthly_price_cents,
      annualPriceCents: plan.annual_price_cents,
      currency: plan.currency,
      aiMessagesPerMonth: aiMessages?.quota_limit ?? null,
      storageBytes: storage?.quota_limit ?? null,
      collaboration: (collaboration?.quota_limit ?? 0) > 0,
    }
  })
}
