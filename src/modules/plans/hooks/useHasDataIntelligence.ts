import { useHasFeature } from '@/modules/plans/hooks/useHasFeature'
import { DATA_INTELLIGENCE_FEATURE_KEY } from '@/modules/plans/dataIntelligence'

/**
 * Data Intelligence Foundation — UX hint only, mirroring
 * useHasProIntelligence exactly. The server-side has_feature RPC (checked
 * inside runCapability before the interpretation call, and explicitly in
 * runDataIntelligenceQuery before the planning call) is the actual
 * boundary.
 */
export function useHasDataIntelligence() {
  return useHasFeature(DATA_INTELLIGENCE_FEATURE_KEY)
}
