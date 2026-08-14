import { useHasFeature } from '@/modules/plans/hooks/useHasFeature'
import { RESEARCH_INTELLIGENCE_FEATURE_KEY } from '@/modules/plans/researchIntelligence'

/**
 * Research Intelligence — UX hint only, mirroring useHasAnalysisIntelligence
 * exactly. The server-side has_feature RPC (checked inside runCapability
 * before the synthesis call, and explicitly in runResearchInvestigation
 * before the first step-planner call) is the actual boundary.
 */
export function useHasResearchIntelligence() {
  return useHasFeature(RESEARCH_INTELLIGENCE_FEATURE_KEY)
}
