import type { AiMemory } from '@/shared/types/database'
import type { IntelligenceSignal } from '@/modules/intelligence/signals/types'
import { findContradictoryMemoryPairs, INACTIVE_WORKSPACE_DAYS } from '@/modules/intelligence/orchestrator/attentionEngine'

/** Retrieval's own MAX_NODES-equivalent bound (retrieveContext.ts requests up to 8 matches) — "we're using essentially everything available." */
const LARGE_CONTEXT_CHUNK_THRESHOLD = 8
/** A conversation has to actually have some length before "drift" is a meaningful claim, not just an early tangent. */
const CONVERSATION_DRIFT_MIN_MESSAGES = 6

function significantWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/\W+/)
      .filter((word) => word.length > 3),
  )
}

function shareSignificantWord(a: string, b: string): boolean {
  const wordsB = significantWords(b)
  return [...significantWords(a)].some((word) => wordsB.has(word))
}

export interface SignalEngineInput {
  retrievedChunks: number
  inProgressDocument: { scrollFraction: number } | null
  memories: AiMemory[]
  workspaceLastActivityAt: string | null
  conversationTitle: string | null
  userQuery: string
  messageCount: number
  now?: Date
}

/** Exported for reuse by UX-11's dashboardInteraction.ts (Review recommendations) — same check, not duplicated. */
export function hasUnreviewedMemory(memories: AiMemory[]): boolean {
  return memories.some((memory) => memory.source === 'conversation' && memory.created_at === memory.updated_at)
}

/**
 * UX-15.3 Phase 4 — the exact `hasMemoryToReview` condition
 * `dashboardInteraction.ts` and `hubData.ts` had each independently
 * written out in full (`findContradictoryMemoryPairs(memories).length >
 * 0 || hasUnreviewedMemory(memories)`); both now call this instead of
 * carrying their own copy of the same boolean expression.
 */
export function hasMemoryNeedingReview(memories: AiMemory[]): boolean {
  return findContradictoryMemoryPairs(memories).length > 0 || hasUnreviewedMemory(memories)
}

/**
 * UX-8 Phase 7 — new signal types only (contradictory_memory,
 * reading_opportunity, unreviewed_memory, inactive_workspace,
 * large_context, conversation_drift). The five UX-6 types
 * (reading_resumed, knowledge_gap_detected, repeated_topic_detected,
 * possible_note_creation, related_concept_discovered) already exist via
 * detectSignals — orchestrator.ts merges both, this function never
 * recomputes them.
 */
export function detectOrchestratorSignals(input: SignalEngineInput): IntelligenceSignal[] {
  const signals: IntelligenceSignal[] = []
  const now = input.now ?? new Date()

  if (findContradictoryMemoryPairs(input.memories).length > 0) {
    signals.push({ type: 'contradictory_memory', message: 'Two stored preferences appear to contradict each other.' })
  }

  if (input.inProgressDocument && input.inProgressDocument.scrollFraction < 0.95) {
    signals.push({ type: 'reading_opportunity', message: 'There is a book in progress you could continue.' })
  }

  if (hasUnreviewedMemory(input.memories)) {
    signals.push({ type: 'unreviewed_memory', message: 'A learned memory has not been reviewed since it was saved.' })
  }

  if (input.workspaceLastActivityAt) {
    const daysSince = Math.floor((now.getTime() - new Date(input.workspaceLastActivityAt).getTime()) / (24 * 60 * 60 * 1000))
    if (daysSince >= INACTIVE_WORKSPACE_DAYS) {
      signals.push({ type: 'inactive_workspace', message: 'This workspace has been inactive for a while.' })
    }
  }

  if (input.retrievedChunks >= LARGE_CONTEXT_CHUNK_THRESHOLD) {
    signals.push({ type: 'large_context', message: 'This answer draws on a large amount of retrieved content.' })
  }

  if (
    input.conversationTitle &&
    input.messageCount >= CONVERSATION_DRIFT_MIN_MESSAGES &&
    !shareSignificantWord(input.conversationTitle, input.userQuery)
  ) {
    signals.push({ type: 'conversation_drift', message: 'This conversation has moved away from its original topic.' })
  }

  return signals
}
