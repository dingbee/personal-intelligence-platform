import { getPriorityOrder } from '@/modules/intelligence/orchestrator/priorityEngine'
import type { ContextSourceDecision, ContextSourceKey } from '@/modules/intelligence/orchestrator/types'

export interface DecisionEngineInput {
  isContinuation: boolean
  hasWorkspace: boolean
  hasRecentReading: boolean
  hasMemory: boolean
  hasGraph: boolean
  hasTimeline: boolean
  hasRecentConversations: boolean
}

const PRESENCE_CHECKS: Record<ContextSourceKey, (input: DecisionEngineInput) => boolean> = {
  continuation: (input) => input.isContinuation,
  workspace: (input) => input.hasWorkspace,
  reading: (input) => input.hasRecentReading,
  memory: (input) => input.hasMemory,
  graph: (input) => input.hasGraph,
  timeline: (input) => input.hasTimeline,
  recentConversations: (input) => input.hasRecentConversations,
  // Always available as the last-resort fallback — there is always *some*
  // workspace scope (even "All"), so this never gates on input.
  genericWorkspace: () => true,
}

/**
 * UX-8 Phase 2 — decides which context sources actually participate this
 * turn: priorityEngine's fixed order, filtered down to sources with real
 * data, each carrying its reason. This is "what should participate," not
 * "what is the answer" — no retrieval, no AI, just presence checks over
 * data the caller already resolved.
 */
export function decideContextSources(input: DecisionEngineInput): ContextSourceDecision[] {
  return getPriorityOrder()
    .map((entry) => ({
      key: entry.key,
      score: entry.score,
      present: PRESENCE_CHECKS[entry.key](input),
      reason: entry.reason,
    }))
    .filter((decision) => decision.present)
}
