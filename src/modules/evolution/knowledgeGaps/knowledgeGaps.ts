import type { KnowledgeHealthIssueType, KnowledgeHealthReport } from '@/modules/evolution/knowledgeHealth/knowledgeHealthScore'
import type { IntelligenceSignal } from '@/modules/intelligence/signals/types'

export type KnowledgeGapType = KnowledgeHealthIssueType | 'isolated_knowledge_island'

export interface KnowledgeGap {
  type: KnowledgeGapType
  message: string
  count: number
}

export interface ComputeKnowledgeGapsInput {
  health: KnowledgeHealthReport
  signals: IntelligenceSignal[]
}

/**
 * UX-13.7 — "gaps" is a reframing of data the app already computes, not a
 * new detector: knowledgeHealthScore.ts's issue list is exactly "what's
 * missing or neglected," minus 'duplicate_concepts' and 'inactive_workspace'
 * (quality/activity problems, not coverage gaps) and plus the
 * 'knowledge_island' signal from graphSignals.ts (a cluster-level isolation
 * knowledgeHealthScore.ts doesn't capture — it only counts single orphaned
 * nodes, not whole disconnected clusters).
 */
const GAP_ISSUE_TYPES: KnowledgeHealthIssueType[] = ['orphaned_concepts', 'unread_documents', 'stale_documents', 'stale_memories']

export function computeKnowledgeGaps(input: ComputeKnowledgeGapsInput): KnowledgeGap[] {
  const gaps: KnowledgeGap[] = input.health.issues
    .filter((issue) => GAP_ISSUE_TYPES.includes(issue.type))
    .map((issue) => ({ type: issue.type, message: issue.message, count: issue.count }))

  const islandSignal = input.signals.find((signal) => signal.type === 'knowledge_island')
  if (islandSignal) {
    gaps.push({ type: 'isolated_knowledge_island', message: islandSignal.message, count: 1 })
  }

  return gaps
}
