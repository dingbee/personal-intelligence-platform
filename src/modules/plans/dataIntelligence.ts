/**
 * ARRIYIA Professional Intelligence — Data Intelligence Foundation.
 *
 * A dedicated feature key, deliberately separate from
 * PRO_INTELLIGENCE_FEATURE_KEY (proIntelligence.ts). The reconciliation
 * audit's Student/Pro/Enterprise section (§3, §5) is explicit that
 * capability access should stay in the `feature:` namespace one key per
 * gated capability family, not folded into the general Pro Intelligence
 * flag — that's what lets a future Student capability request
 * 'feature:data_intelligence' with a more bounded plan shape later,
 * without inheriting every other Pro Intelligence capability and without
 * any change to the persisted dataset table or the deterministic
 * execution engine (both of which carry no gating of their own — see
 * executeAnalyticalPlan.ts).
 *
 * Resolved through the same plan_quotas/has_feature machinery as every
 * other feature flag (0046_feature_entitlements_and_storage_quota.sql,
 * 0058_data_intelligence_entitlement.sql) — no new entitlement mechanism.
 */
export const DATA_INTELLIGENCE_FEATURE_KEY = 'data_intelligence'
