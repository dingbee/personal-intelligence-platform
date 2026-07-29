import type { KnowledgeLink } from '@/shared/types/database'
import { countWithinDays, deriveTrendDirection, type TrendDirection } from '@/modules/evolution/shared/trend'

export interface RelationshipEvolution {
  last7Days: number
  last30Days: number
  allTime: number
  /** The most common relationship_type among edges formed in the last 30 days, or null if none are typed/none exist. */
  topRelationshipType: string | null
  direction: TrendDirection
}

const RECENT_WINDOW_DAYS = 7
const BASELINE_WINDOW_DAYS = 30

/**
 * UX-13 — how the AI-generated relationship graph (knowledge_links with
 * generated_by set — the same "only AI-generated edges count" convention
 * conceptClusters/graphSignals/relationshipStrength all share) is growing
 * over time. Counts only; no new detection, no AI classification.
 */
export function computeRelationshipEvolution(edges: KnowledgeLink[], now: Date = new Date()): RelationshipEvolution {
  const aiEdges = edges.filter((edge) => Boolean(edge.generated_by))
  const timestamps = aiEdges.map((e) => e.created_at)

  const last7Days = countWithinDays(timestamps, now, RECENT_WINDOW_DAYS)
  const last30Days = countWithinDays(timestamps, now, BASELINE_WINDOW_DAYS)
  const allTime = aiEdges.length

  const recentTypedEdges = aiEdges.filter(
    (e) => e.relationship_type !== null && now.getTime() - new Date(e.created_at).getTime() <= BASELINE_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  )
  const typeCounts = new Map<string, number>()
  for (const edge of recentTypedEdges) {
    const type = edge.relationship_type!
    typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1)
  }
  let topRelationshipType: string | null = null
  let topCount = 0
  for (const [type, count] of typeCounts) {
    if (count > topCount) {
      topCount = count
      topRelationshipType = type
    }
  }

  return {
    last7Days,
    last30Days,
    allTime,
    topRelationshipType,
    direction: deriveTrendDirection(last7Days, last30Days, RECENT_WINDOW_DAYS, BASELINE_WINDOW_DAYS),
  }
}
