import type { ContextTrace } from '@/modules/ai/orchestration/buildContextTrace'

export type EvidenceLevel = 'High' | 'Medium' | 'Low'

/**
 * UX-7 Phase 8 — pure, deterministic, no AI scoring. Reuses exactly the
 * same contextTrace UX-5.2/UX-6 already compute, plus continuation
 * (already-built isContinuationMessage, passed in as a bool so this stays
 * a plain data-in function). Documents carry the most weight (they're the
 * actual retrieved evidence); graph/memory/continuity are corroborating
 * signals, not substitutes for having found anything at all.
 */
export function computeEvidenceScore(params: { contextTrace: ContextTrace; isContinuation: boolean }): EvidenceLevel {
  const { contextTrace, isContinuation } = params
  if (contextTrace.retrievedChunks === 0) return 'Low'

  const corroboration = (contextTrace.graphNodes > 0 ? 1 : 0) + (contextTrace.memoriesUsed > 0 ? 1 : 0) + (isContinuation ? 1 : 0)

  return contextTrace.retrievedChunks >= 3 && corroboration > 0 ? 'High' : 'Medium'
}
