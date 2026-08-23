import type { AiMemory } from '@/shared/types/database'
import { computeEffectiveConfidence } from '@/modules/ai/memory/computeEffectiveConfidence'

/**
 * AI Experience Intelligence Layer v1 — the one gap found in the existing
 * memory system: `confidence` (0027_ai_memory_confidence.sql) was captured
 * at candidate-approval time but never read back at retrieval time, so a
 * memory NOVA itself scored low-confidence carried the same weight as a
 * high-confidence one. Shared by formatMemoriesForPrompt (what actually
 * goes in the prompt) and isMemoryUsedByPrompt (the "used by NOVA" badge)
 * so the two can never drift from each other, same discipline the prior
 * recency-only version already followed.
 *
 * UX-14.2 Memory Evolution — ranks by *effective* confidence descending
 * (nulls last — an unscored memory, e.g. the manual "+ Add" form which
 * sets no confidence, isn't penalized below a low-scored one, but a
 * scored memory always outranks an unscored one only when scores differ),
 * then by most-recently-updated as the tie-break. Effective confidence
 * (computeEffectiveConfidence) folds recency and reinforcement into the
 * primary sort key itself — a memory reinforced last week naturally
 * outranks a stale one of the same original confidence, without recency
 * needing to be a separate sort key of its own. `now` is threaded through
 * (defaulting to the real clock) purely so tests can pin decay to a fixed
 * instant; every existing call site is unaffected.
 */
export function rankMemories(memories: AiMemory[], now: Date = new Date()): AiMemory[] {
  return [...memories].sort((a, b) => {
    const effectiveA = computeEffectiveConfidence(a, now)
    const effectiveB = computeEffectiveConfidence(b, now)
    if (effectiveA !== effectiveB) {
      if (effectiveA === null) return 1
      if (effectiveB === null) return -1
      return effectiveB - effectiveA
    }
    return a.updated_at < b.updated_at ? 1 : -1
  })
}
