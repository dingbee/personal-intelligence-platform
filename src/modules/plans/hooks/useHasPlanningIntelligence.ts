import { useHasFeature } from '@/modules/plans/hooks/useHasFeature'
import { PLANNING_INTELLIGENCE_FEATURE_KEY } from '@/modules/plans/planningIntelligence'

/**
 * UX hint only, mirroring useHasResearchIntelligence exactly. The
 * server-side has_feature RPC (checked inside runCapability before the
 * plan-generation call, and explicitly in runPlanningIntelligence before
 * the operation begins) is the actual boundary.
 */
export function useHasPlanningIntelligence() {
  return useHasFeature(PLANNING_INTELLIGENCE_FEATURE_KEY)
}
