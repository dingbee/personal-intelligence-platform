import { useHasFeature } from '@/modules/plans/hooks/useHasFeature'
import { ANALYSIS_INTELLIGENCE_FEATURE_KEY } from '@/modules/plans/analysisIntelligence'

/**
 * Analysis Intelligence — UX hint only, mirroring useHasDataIntelligence
 * exactly. The server-side has_feature RPC (checked inside runCapability
 * before the synthesis call, and explicitly in runAnalysisInvestigation
 * before the first step-planner call) is the actual boundary.
 */
export function useHasAnalysisIntelligence() {
  return useHasFeature(ANALYSIS_INTELLIGENCE_FEATURE_KEY)
}
