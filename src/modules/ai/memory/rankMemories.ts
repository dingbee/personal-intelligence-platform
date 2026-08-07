import type { AiMemory } from '@/shared/types/database'

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
 * Ranks by confidence descending (nulls last — an unscored memory, e.g.
 * the manual "+ Add" form which sets no confidence, isn't penalized below
 * a low-scored one, but a scored memory always outranks an unscored one
 * only when scores differ), then by most-recently-updated as the
 * tie-break — the previous, sole ranking rule.
 */
export function rankMemories(memories: AiMemory[]): AiMemory[] {
  return [...memories].sort((a, b) => {
    if (a.confidence !== b.confidence) {
      if (a.confidence === null) return 1
      if (b.confidence === null) return -1
      return b.confidence - a.confidence
    }
    return a.updated_at < b.updated_at ? 1 : -1
  })
}
