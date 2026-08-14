import { useHasFeature } from '@/modules/plans/hooks/useHasFeature'
import { ACTION_INTELLIGENCE_FEATURE_KEY } from '@/modules/plans/actionIntelligence'

/**
 * UX hint only, mirroring useHasDecisionIntelligence exactly. The
 * server-side has_feature RPC (checked inside runCapability before the
 * generation call, and explicitly in runActionIntelligence before the
 * operation begins) is the actual boundary.
 */
export function useHasActionIntelligence() {
  return useHasFeature(ACTION_INTELLIGENCE_FEATURE_KEY)
}
