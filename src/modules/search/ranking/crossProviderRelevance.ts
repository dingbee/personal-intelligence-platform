import { computeRecencyBonus } from '@/modules/search/ranking/conversationScore'

/**
 * UX-13.11 Phase 3 (Universal Search Maturity) — "cross-provider ranking
 * refinement": before this, only conversations got a recency bonus (via
 * computeConversationScore), so a stale conversation and a fresh document
 * with identical raw similarity weren't actually comparable — conversations
 * had a structural advantage documents/notes never got a chance at. This
 * applies the same recency signal to every source uniformly, once, in
 * runUniversalSearch's merge step, after each provider's own source-
 * specific scoring (e.g. conversations' support bonus) has already run.
 * Missing updatedAt (a provider that doesn't supply it) is a no-op, not a
 * penalty — a result isn't punished for a signal it doesn't have.
 */
export function applyRecencyBonus(similarity: number, updatedAt: string | undefined, now?: Date): number {
  if (!updatedAt) return similarity
  return Math.min(similarity + computeRecencyBonus(updatedAt, now), 1)
}
