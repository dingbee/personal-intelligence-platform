/**
 * ARRIYIA Professional Intelligence — Planning Intelligence.
 *
 * A dedicated feature key, following the exact precedent set by
 * DATA_INTELLIGENCE_FEATURE_KEY, ANALYSIS_INTELLIGENCE_FEATURE_KEY, and
 * RESEARCH_INTELLIGENCE_FEATURE_KEY: each professional-intelligence
 * capability is entitled independently of the others and of general Pro
 * Intelligence, so e.g. an admin can disable Planning alone during an
 * incident, or a future bounded tier can grant it without inheriting
 * every sibling capability. Seeded for pro/founding_pro only in
 * 0062_planning_intelligence_entitlement.sql, resolved through the same
 * plan_quotas/has_feature machinery as every other feature flag — no new
 * entitlement mechanism.
 */
export const PLANNING_INTELLIGENCE_FEATURE_KEY = 'planning_intelligence'
