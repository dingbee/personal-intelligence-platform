import { deriveActionChips } from '@/modules/intelligence/actions/deriveActionChips'
import { buildResumeConversationCommand } from '@/modules/commands/commands/conversationCommands'
import { openKnowledgeGraphCommand } from '@/modules/commands/commands/knowledgeCommands'
import type { CommandContext } from '@/modules/commands/types'
import type { ActionSuggestion } from '@/modules/intelligence/orchestrator/types'

export interface SuggestionEngineInput {
  commandContext: CommandContext
  /** True when this turn's knowledgeContext was non-null — gates "Explore knowledge graph," so it's only offered when the graph actually contributed. */
  hasGraphContext: boolean
  /** From resurfacingEngine — the most relevant resurfaced conversation, if any. */
  relatedConversation: { id: string; title: string } | null
  /** From workspaceInsightEngine's 'most_active' insight — offered only when it isn't already the current workspace. */
  mostActiveWorkspace: { id: string; name: string } | null
}

/**
 * UX-8 Phase 6/10 — every suggestion here is either an existing registry
 * command (deriveActionChips, unchanged from UX-7) or a thin dynamic
 * wrapper around an existing route/action (buildResumeConversationCommand,
 * openKnowledgeGraphCommand, buildWorkspaceSwitchCommands) — no new
 * capability, no duplicated execution logic. "Compare with previous
 * answer," "Summarize this document," and "Create flashcards" from the
 * brief's example list are deliberately omitted: none of them exist as a
 * document-agnostic registry command today (see UX-7's same finding), and
 * inventing one would be new capability surface, not reuse.
 */
export function deriveActionSuggestions(input: SuggestionEngineInput): ActionSuggestion[] {
  const suggestions: ActionSuggestion[] = deriveActionChips(input.commandContext).map((command) => ({
    command,
    reason: 'Existing capability relevant to this session.',
  }))

  if (input.hasGraphContext) {
    suggestions.push({
      command: openKnowledgeGraphCommand,
      reason: 'Knowledge graph connections contributed to this answer.',
    })
  }

  if (input.relatedConversation) {
    suggestions.push({
      command: buildResumeConversationCommand(input.relatedConversation),
      reason: `A related past conversation ("${input.relatedConversation.title}") may be worth revisiting.`,
    })
  }

  if (input.mostActiveWorkspace && input.mostActiveWorkspace.id !== input.commandContext.workspaceId) {
    const { id, name } = input.mostActiveWorkspace
    suggestions.push({
      // Same shape/action as buildWorkspaceSwitchCommands (setCurrentWorkspaceId)
      // — built inline because that function's signature wants a full
      // Workspace row and this engine only ever has {id, name}.
      command: {
        id: `workspace-switch-${id}`,
        title: `Switch to ${name}`,
        icon: '🏢',
        category: 'workspace',
        execute: (_context, actions) => actions.setCurrentWorkspaceId(id),
      },
      reason: `"${name}" is your most active workspace.`,
    })
  }

  return suggestions
}
