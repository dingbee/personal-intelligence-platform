import type { Recommendation } from '@/modules/intelligence/recommendations/recommendationEngine'

/** The item_key derivation shared between RecommendedActionsSection's dismiss button and its own filtering — a Recommendation has no id of its own, so category+command.id (unique per command) is the stable identity. */
export function recommendationItemKey(recommendation: Pick<Recommendation, 'category' | 'command'>): string {
  return `${recommendation.category}:${recommendation.command.id}`
}
