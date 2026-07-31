/**
 * UX-13.11 Phase 2A — a conversation's relevance is more than its single
 * best-matching message: a conversation with several supporting matches, or
 * one that was touched recently, is a stronger candidate than a lone hit in
 * a stale thread. This is a light nudge on top of semantic similarity, not
 * a new ranking system — the full "NOVA relevance score" (workspace
 * relevance, prior interactions, confidence) is future Phase 3 work.
 */

/** Each additional matching message beyond the first adds a small, diminishing bonus, capped so a conversation can't out-rank a much stronger single match purely by message volume. */
export function computeSupportBonus(matchCount: number): number {
  return Math.min(0.03 * Math.max(matchCount - 1, 0), 0.15)
}

/** Recently-touched conversations get a small boost; anything over a month old gets none. */
export function computeRecencyBonus(updatedAt: string, now: Date = new Date()): number {
  const daysSince = (now.getTime() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24)
  if (daysSince <= 1) return 0.05
  if (daysSince <= 7) return 0.03
  if (daysSince <= 30) return 0.01
  return 0
}

/** Clamped to 1 (same ceiling as cosine similarity) so a conversation's boosted score stays comparable to raw document/note similarity in the cross-source sort. */
export function computeConversationScore(params: {
  topSimilarity: number
  matchCount: number
  updatedAt: string
  now?: Date
}): number {
  const raw = params.topSimilarity + computeSupportBonus(params.matchCount) + computeRecencyBonus(params.updatedAt, params.now)
  return Math.min(raw, 1)
}

/** Maps a 0-1 score to a 1-5 star display rating. */
export function scoreToStars(score: number): number {
  return Math.min(5, Math.max(1, Math.round(score * 5)))
}
