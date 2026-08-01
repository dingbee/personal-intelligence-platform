/**
 * UX-13.11 Phase 3 (Universal Search Maturity) — "hybrid semantic + lexical
 * search": embedding similarity alone can miss a literal, exact-name query
 * ("Mtoni") if the embedding model doesn't score that specific title highly
 * against the query embedding. A lexical (substring/ILIKE) match against
 * the same content is a second, deterministic signal — no LLM call, same
 * "deterministic reinforcement, not a replacement for the real thing"
 * philosophy the Phase 2B concept matcher already established for the
 * Knowledge Graph.
 *
 * Lexical reinforces an existing semantic hit (a boost) rather than
 * competing with it — matches the same "corroborating signal as a bonus"
 * pattern conversation scoring uses for supporting messages. An item found
 * only lexically (no semantic hit strong enough to surface at all) still
 * gets to appear, but at a base score deliberately below where a genuine
 * semantic match would land, so it can supplement results without ever
 * outranking one.
 */
export const LEXICAL_MATCH_BOOST = 0.1
export const LEXICAL_ONLY_BASE_SCORE = 0.35

export function applyLexicalBoost(semanticSimilarity: number, matchedLexically: boolean): number {
  if (!matchedLexically) return semanticSimilarity
  return Math.min(semanticSimilarity + LEXICAL_MATCH_BOOST, 1)
}
