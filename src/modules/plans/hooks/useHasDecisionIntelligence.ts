import { useHasFeature } from '@/modules/plans/hooks/useHasFeature'
import { DECISION_INTELLIGENCE_FEATURE_KEY } from '@/modules/plans/decisionIntelligence'

/**
 * UX hint only, mirroring useHasPlanningIntelligence exactly. The
 * server-side has_feature RPC (checked inside runCapability before the
 * recommendation call, and explicitly in runDecisionIntelligence before
 * the operation begins) is the actual boundary.
 */
export function useHasDecisionIntelligence() {
  return useHasFeature(DECISION_INTELLIGENCE_FEATURE_KEY)
}
