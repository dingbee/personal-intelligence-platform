import type { NovaContext } from '@/modules/intelligence/context/types'

export interface GenerateFollowUpSuggestionsParams {
  /** matches.length from this turn's RAG retrieval — the same count AIService already has. */
  matchCount: number
  context: NovaContext
}

/**
 * UX-6 Phase 5: derives "would you like me to..." suggestions from what was
 * actually true this turn — never a fixed/generic button set. Returns []
 * when nothing justifies a suggestion (e.g. no documents matched, no graph
 * connections, no in-progress reading) rather than falling back to
 * something generic.
 */
export function generateFollowUpSuggestions(params: GenerateFollowUpSuggestionsParams): string[] {
  const { matchCount, context } = params
  const suggestions: string[] = []

  if (matchCount > 0) suggestions.push('Create notes from this?')
  if (context.knowledgeContext) suggestions.push('Explore related concepts?')
  if (context.activityContext?.inProgressDocument) {
    suggestions.push(`Continue reading "${context.activityContext.inProgressDocument.title}"?`)
  }

  return suggestions
}
