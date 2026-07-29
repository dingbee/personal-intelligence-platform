import type { NovaContext } from '@/modules/intelligence/context/types'

export type ContextSourceKey = 'memoryContext' | 'activityContext' | 'knowledgeContext' | 'workspaceContext' | 'userContext'

export interface RankedContextSource {
  key: ContextSourceKey
  score: number
}

/**
 * Higher = more relevant when something has to be cut for space. Memory
 * (personalization) ranks above situational activity, which ranks above
 * background knowledge-graph/workspace/identity facts — deliberately NOT
 * the same ordering as formatMemoriesForPrompt's SECTION_ORDER, which
 * ranks trustworthiness of a stored fact, not relevance of a context
 * *source* to this new situational layer.
 */
const BASE_PRIORITY: Record<ContextSourceKey, number> = {
  memoryContext: 40,
  activityContext: 30,
  knowledgeContext: 20,
  workspaceContext: 10,
  userContext: 5,
}

function isSourcePresent(context: NovaContext, key: ContextSourceKey): boolean {
  switch (key) {
    case 'memoryContext':
      return Boolean(context.memoryContext)
    case 'activityContext':
      return Boolean(
        context.activityContext?.inProgressDocument || (context.activityContext?.recentConversations.length ?? 0) > 0,
      )
    case 'knowledgeContext':
      return Boolean(context.knowledgeContext)
    case 'workspaceContext':
      return Boolean(context.workspaceContext?.workspaceName)
    case 'userContext':
      return Boolean(context.userContext)
  }
}

/**
 * Pure ranking over whatever contextResolver actually returned this turn —
 * only sources with real content are included, highest-priority first.
 * Used both by contextFormatter (what to render into the prompt) and the
 * Phase 7 "Used: ..." UI indicator (what to show the user).
 */
export function rankNovaContext(context: NovaContext): RankedContextSource[] {
  return (Object.keys(BASE_PRIORITY) as ContextSourceKey[])
    .filter((key) => isSourcePresent(context, key))
    .map((key) => ({ key, score: BASE_PRIORITY[key] }))
    .sort((a, b) => b.score - a.score)
}
