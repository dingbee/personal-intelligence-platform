import { useHasFeature } from '@/modules/plans/hooks/useHasFeature'
import { LEARNING_INTELLIGENCE_FEATURE_KEY } from '@/modules/plans/learningIntelligence'

/** UX hint only, mirroring useHasActionIntelligence exactly. The server-side has_feature check inside record_intelligence_outcome() is the actual boundary. */
export function useHasLearningIntelligence() {
  return useHasFeature(LEARNING_INTELLIGENCE_FEATURE_KEY)
}
