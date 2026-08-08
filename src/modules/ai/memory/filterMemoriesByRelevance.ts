import type { AiMemory } from '@/shared/types/database'
import { extractLexicalSearchTerms } from '@/modules/ai/orchestration/extractLexicalSearchTerms'

/**
 * PIP Sprint 6/10 — the one real gap discovery found: retrieveMemoryContext
 * injected every active memory (capped per type) regardless of whether it
 * had anything to do with the current question. `explicit_profile` and
 * `learned_preference` are durable, topic-independent personalization
 * (identity, communication style — their own prompt section titles say so:
 * "What NOVA knows about you" / "Learned preferences") and correctly stay
 * unfiltered, matching Phase 2's Test A/B ("a stated preference should
 * apply without the user repeating it," "later asks for a report" is
 * exactly this). `conversation_memory` ("From past conversations") is
 * different by construction — its own detection patterns
 * (detectMemoryCandidates: "I'm researching/working on/writing/building/
 * studying X") are inherently project/topic-scoped — so it's the one type
 * Test C's "irrelevant memory must not be injected merely because it
 * exists" actually applies to.
 *
 * Reuses extractLexicalSearchTerms (Sprint 4/5) rather than a new
 * extraction function — same deliberately-conservative, lexical-only
 * philosophy: a false negative (missing an occasionally-relevant memory
 * phrased without a proper noun) just means no personalization boost for
 * that turn; a false positive never happens because there's nothing to
 * "over-match" against — the memory is simply excluded when no term
 * overlaps, which is the safer default per Test C.
 */
export function filterMemoriesByRelevance(memories: AiMemory[], text: string): AiMemory[] {
  const terms = extractLexicalSearchTerms(text).map((term) => term.toLowerCase())

  return memories.filter((memory) => {
    if (memory.memory_type !== 'conversation_memory') return true
    if (terms.length === 0) return false
    const content = memory.content.toLowerCase()
    return terms.some((term) => content.includes(term))
  })
}
