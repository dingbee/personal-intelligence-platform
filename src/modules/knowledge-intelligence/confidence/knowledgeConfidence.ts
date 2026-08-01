/**
 * UX-13 roadmap, Phase 2 — Knowledge Confidence. Every concept eventually
 * needs a computable answer to "how sure are we?", not just a list of
 * sources. This is the first, deliberately narrow version: four
 * deterministic, already-available signals, no LLM call, same
 * "deterministic reinforcement" philosophy as the Phase 2B concept matcher
 * and Phase 3 hybrid search boosts.
 *
 * Explicitly NOT attempted here (would need genuinely new infrastructure,
 * not just composing existing data):
 * - Contradiction detection — would require an LLM comparing evidence
 *   passages pairwise for conflicting claims; no such capability exists yet.
 * - Reading coverage — would require correlating a node's evidence source
 *   IDs against reading_progress rows, and it's unclear how that composes
 *   for a concept whose evidence spans many different documents.
 * Both are real, worth building — just not this phase, and not silently
 * faked here as if they were already factored in.
 */

export interface KnowledgeConfidenceInputs {
  /** e.g. { document: 3, note: 1, conversation: 2 } — from KnowledgeNodeEvidence.countsBySourceType. */
  sourceCounts: Record<string, number>
  /** ISO timestamp of the single most recent piece of evidence, or null if there's none at all. */
  mostRecentEvidenceAt: string | null
  /** How many other concepts this one is connected to via knowledge_links — a concept embedded in a web of relationships is better-attested than an isolated one. */
  relatedConceptCount: number
  now?: Date
}

const SOURCE_TYPES = ['document', 'note', 'conversation']

/** More evidence increases confidence, with diminishing returns — 5+ sources is treated as fully corroborated regardless of how many more pile up. */
function sourceCountFactor(sourceCounts: Record<string, number>): number {
  const total = Object.values(sourceCounts).reduce((sum, count) => sum + count, 0)
  return Math.min(total / 5, 1)
}

/** Being mentioned across different *kinds* of sources (not just many times in one) is a stronger corroboration signal than volume alone. */
function diversityFactor(sourceCounts: Record<string, number>): number {
  const distinctTypes = SOURCE_TYPES.filter((type) => (sourceCounts[type] ?? 0) > 0).length
  return distinctTypes / SOURCE_TYPES.length
}

/** Recent evidence keeps a concept "live"; old evidence isn't wrong, just less current — this never drops to zero, unlike a pure recency bonus. */
function freshnessFactor(mostRecentEvidenceAt: string | null, now: Date = new Date()): number {
  if (!mostRecentEvidenceAt) return 0
  const daysSince = (now.getTime() - new Date(mostRecentEvidenceAt).getTime()) / (1000 * 60 * 60 * 24)
  if (daysSince <= 7) return 1
  if (daysSince <= 30) return 0.7
  if (daysSince <= 90) return 0.4
  if (daysSince <= 365) return 0.2
  return 0.05
}

/** A concept connected to several others sits inside real context, not floating alone — a secondary, smaller-weighted corroboration signal. */
function relationshipFactor(relatedConceptCount: number): number {
  return Math.min(relatedConceptCount / 4, 1)
}

/** Weighted sum, each factor already 0-1 and weights summing to 1 — the result is always in [0, 1]. */
export function computeKnowledgeConfidence(inputs: KnowledgeConfidenceInputs): number {
  return (
    0.45 * sourceCountFactor(inputs.sourceCounts) +
    0.25 * diversityFactor(inputs.sourceCounts) +
    0.2 * freshnessFactor(inputs.mostRecentEvidenceAt, inputs.now) +
    0.1 * relationshipFactor(inputs.relatedConceptCount)
  )
}
