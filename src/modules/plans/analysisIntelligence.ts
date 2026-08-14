/**
 * ARRIYIA Professional Intelligence — Analysis Intelligence.
 *
 * A dedicated feature key, separate from DATA_INTELLIGENCE_FEATURE_KEY
 * and PRO_INTELLIGENCE_FEATURE_KEY — see
 * plans/dataIntelligence.ts's doc comment for the precedent this
 * follows, and docs/analysis-intelligence-architecture-audit.md §14/§22
 * for why Analysis Intelligence specifically needs its own key: the
 * investigation engine (analysis-intelligence/) carries no gating of
 * its own, only the one exposed capability does, so a future Student
 * capability can request bounded analytical investigation later without
 * inheriting full Data/Pro Intelligence.
 *
 * Resolved through the same plan_quotas/has_feature machinery as every
 * other feature flag (0046, 0056, 0058, 0059_analysis_intelligence_-
 * entitlement.sql) — no new entitlement mechanism.
 */
export const ANALYSIS_INTELLIGENCE_FEATURE_KEY = 'analysis_intelligence'
