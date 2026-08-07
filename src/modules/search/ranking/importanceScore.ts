/**
 * Knowledge Intelligence Layer v1, Feature 7 — "importance" as a search
 * ranking signal: a document/note/image/conversation cited as evidence by
 * more knowledge nodes is structurally more central to the workspace than
 * one nothing references. Uses `knowledge_node_sources` counts (already
 * the same evidence ledger `getKnowledgeNodeEvidence`/`computeKnowledgeConfidence`
 * read), not a new signal source. Applied the same additive, uniform way
 * `applyRecencyBonus` already is — small and capped, never enough to
 * override a genuinely better semantic/lexical match.
 */
const IMPORTANCE_UNIT = 0.02
const MAX_IMPORTANCE_BONUS = 0.1

export function computeImportanceBonus(evidenceCount: number): number {
  if (evidenceCount <= 0) return 0
  return Math.min(evidenceCount * IMPORTANCE_UNIT, MAX_IMPORTANCE_BONUS)
}

export function applyImportanceBonus(similarity: number, evidenceCount: number | undefined): number {
  if (!evidenceCount) return similarity
  return Math.min(similarity + computeImportanceBonus(evidenceCount), 1)
}
