import { useHasFeature } from '@/modules/plans/hooks/useHasFeature'
import { PRO_INTELLIGENCE_FEATURE_KEY } from '@/modules/plans/proIntelligence'

/**
 * Phase P0 Pro Intelligence Foundation — the one hook any current or
 * future UI needs to answer "does this user have Pro Intelligence
 * capability" (Advanced AI Workspace, Research/Planning/Deep Academic
 * Intelligence). Thin wrapper over the existing useHasFeature, so
 * Founding Pro/Pro parity and server-authoritative resolution come for
 * free — see proIntelligence.ts. UX hint only, same as every other
 * useHasFeature call site: the server-side has_feature RPC (and any
 * future capability's own entitlement re-check) is the actual boundary.
 */
export function useHasProIntelligence() {
  return useHasFeature(PRO_INTELLIGENCE_FEATURE_KEY)
}
