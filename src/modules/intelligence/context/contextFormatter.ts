import { formatRelativeTime } from '@/shared/utils/formatRelativeTime'
import { rankNovaContext, type ContextSourceKey } from '@/modules/intelligence/context/contextPriority'
import type { NovaContext } from '@/modules/intelligence/context/types'

/**
 * memoryContext deliberately renders nothing new here — its actual content
 * is already in the prompt via buildSystemPrompt's own <personal_context>
 * block (UX-5.2). It still participates in rankNovaContext (used by the
 * Phase 7 "Used: ..." UI indicator), but formatting it again here would
 * duplicate prompt content.
 */
const SECTION_RENDERERS: Record<ContextSourceKey, (context: NovaContext) => string | null> = {
  memoryContext: () => null,
  attentionContext: (context) => context.attentionContext?.topItem.message ?? null,
  activityContext: (context) => {
    const activity = context.activityContext
    if (!activity) return null
    const lines: string[] = []
    if (activity.inProgressDocument) {
      lines.push(
        `Currently reading: "${activity.inProgressDocument.title}" (last opened ${formatRelativeTime(activity.inProgressDocument.updatedAt)}).`,
      )
    }
    if (activity.recentConversations.length > 0) {
      lines.push(`Recent conversation topics: ${activity.recentConversations.map((c) => c.title).join('; ')}.`)
    }
    return lines.length > 0 ? lines.join('\n') : null
  },
  knowledgeContext: (context) => {
    const knowledge = context.knowledgeContext
    if (!knowledge) return null
    return `${knowledge.nodeCount} related knowledge connection${knowledge.nodeCount === 1 ? '' : 's'} available from the user's knowledge graph.`
  },
  workspaceContext: (context) => {
    const workspace = context.workspaceContext
    if (!workspace?.workspaceName) return null
    return `Current workspace: ${workspace.workspaceName} (${workspace.documentCount} document${workspace.documentCount === 1 ? '' : 's'}).`
  },
  userContext: (context) => {
    const user = context.userContext
    return user ? `Speaking with: ${user.displayName}.` : null
  },
  evolutionContext: (context) => context.evolutionContext?.summary ?? null,
}

/**
 * Renders the situational-context section of buildNovaContextPrompt,
 * highest-priority source first. Returns null when nothing is available —
 * an empty NovaContext must not inject an empty/awkward block into the
 * prompt.
 */
export function formatNovaContext(context: NovaContext): string | null {
  const lines = rankNovaContext(context)
    .map((source) => SECTION_RENDERERS[source.key](context))
    .filter((line): line is string => Boolean(line))

  return lines.length > 0 ? lines.join('\n') : null
}
