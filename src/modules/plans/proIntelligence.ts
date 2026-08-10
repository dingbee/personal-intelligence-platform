/**
 * ARRIYIA Professional Intelligence — Phase P0 Pro Intelligence Foundation.
 *
 * The single feature key gating every future Advanced AI Workspace /
 * Research / Planning / Deep Academic Intelligence capability, resolved
 * through the existing plan_quotas/has_feature machinery
 * (0046_feature_entitlements_and_storage_quota.sql) exactly like
 * 'collaboration' already is — no new entitlement mechanism.
 *
 * Founding Pro receives this automatically: 0056_pro_intelligence_-
 * foundation.sql seeds this key identically for the 'pro' and
 * 'founding_pro' plan rows, and Founding Pro membership already flows
 * through the same active user_plan_assignments row every other plan
 * resolution reads — there is no separate "Founding Pro intelligence"
 * check to write or keep in sync.
 */
export const PRO_INTELLIGENCE_FEATURE_KEY = 'pro_intelligence'
