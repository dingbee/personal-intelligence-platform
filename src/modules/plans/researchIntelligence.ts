/**
 * ARRIYIA Professional Intelligence — Research Intelligence (P2).
 *
 * A dedicated feature key, following the exact precedent set by
 * DATA_INTELLIGENCE_FEATURE_KEY and ANALYSIS_INTELLIGENCE_FEATURE_KEY
 * rather than the P2 brief's literal fallback of reusing
 * 'pro_intelligence' directly: this codebase has now demonstrated the
 * same pattern twice (0058, 0059) specifically so each professional-
 * intelligence capability can be entitled independently of the others
 * and of general Pro Intelligence — e.g. a future bounded Student
 * capability requesting research access without inheriting Data/
 * Analysis/Pro Intelligence, or an admin disabling Research Intelligence
 * alone during an incident without touching sibling capabilities. That
 * is the "demonstrably better established mechanism" the P2 brief's own
 * fallback clause anticipates. Seeded for pro/founding_pro only in
 * 0060_research_intelligence_entitlement.sql, resolved through the same
 * plan_quotas/has_feature machinery as every other feature flag — no new
 * entitlement mechanism.
 */
export const RESEARCH_INTELLIGENCE_FEATURE_KEY = 'research_intelligence'
