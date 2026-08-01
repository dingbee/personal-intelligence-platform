/**
 * UX-13.11 Phase 2A — a conversation's relevance is more than its single
 * best-matching message: a conversation with several supporting matches is
 * a stronger candidate than a lone hit. This is a light, conversation-
 * specific nudge on top of semantic similarity — the structural "several
 * messages corroborate this" signal only conversations have, since Phase
 * 2A grouped them by whole conversation rather than one result per message.
 *
 * Recency used to be folded in here too, but Phase 3 (Universal Search
 * Maturity) moved it out to runUniversalSearch's applyRecencyBonus
 * (crossProviderRelevance.ts) so every source — documents and notes
 * included, not just conversations — gets the same recency treatment
 * uniformly, instead of conversations getting a bonus no other source did.
 */

/** Each additional matching message beyond the first adds a small, diminishing bonus, capped so a conversation can't out-rank a much stronger single match purely by message volume. */
export function computeSupportBonus(matchCount: number): number {
  return Math.min(0.03 * Math.max(matchCount - 1, 0), 0.15)
}

/** Recently-touched items get a small boost; anything over a month old gets none. Shared across all sources via applyRecencyBonus, not conversation-specific despite living in this file historically. */
export function computeRecencyBonus(updatedAt: string, now: Date = new Date()): number {
  const daysSince = (now.getTime() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24)
  if (daysSince <= 1) return 0.05
  if (daysSince <= 7) return 0.03
  if (daysSince <= 30) return 0.01
  return 0
}

/** Clamped to 1 (same ceiling as cosine similarity) so a conversation's boosted score stays comparable to raw document/note similarity in the cross-source sort. Recency is applied afterward, uniformly, by runUniversalSearch — not here. */
export function computeConversationScore(params: { topSimilarity: number; matchCount: number }): number {
  const raw = params.topSimilarity + computeSupportBonus(params.matchCount)
  return Math.min(raw, 1)
}

/** Maps a 0-1 score to a 1-5 star display rating. */
export function scoreToStars(score: number): number {
  return Math.min(5, Math.max(1, Math.round(score * 5)))
}
