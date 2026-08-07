import type { Command, CommandContext } from '@/modules/commands/types'
import { deriveActionChips } from '@/modules/intelligence/actions/deriveActionChips'
import { buildResumeConversationCommand } from '@/modules/commands/commands/conversationCommands'
import { openKnowledgeGraphCommand } from '@/modules/commands/commands/knowledgeCommands'
import { buildContinueReadingCommand } from '@/modules/commands/commands/readerCommands'
import { manageMemoriesCommand, reviewMemorySuggestionsCommand } from '@/modules/commands/commands/memoryCommands'
import { navigationCommands } from '@/modules/commands/commands/navigationCommands'
import { createNoteCommand } from '@/modules/commands/commands/noteCommands'

export type RecommendationCategory = 'explore' | 'review' | 'continue' | 'organize'

/** The one recommendation shape every consumer (chat, dashboard, and eventually the notification center) reads. */
export interface Recommendation {
  category: RecommendationCategory
  command: Command
  reason: string
}

const ORGANIZATION_SCORE_THRESHOLD = 70
const navLibraryCommand = navigationCommands.find((command) => command.id === 'nav-library')!

export interface GenerateRecommendationsInput {
  /**
   * UX-14.1 (Architecture Consolidation) — the two engines this replaces
   * (orchestrator/suggestionEngine.ts's deriveActionSuggestions and
   * dashboard/dashboardRecommendations.ts's generateDashboardRecommendations)
   * answered the same question ("what should the user do next?") with
   * genuinely different rule sets for genuinely different surfaces, not
   * two copies of the same rules. `scope` keeps that difference explicit
   * in one file instead of two files that could silently drift apart —
   * it does not merge the rule sets into one shared rule set, since that
   * would be new intelligence, not consolidation.
   */
  scope: 'chat' | 'dashboard'
  commandContext: CommandContext
  /** True when this turn/session's knowledge graph contributed context — gates "Explore knowledge graph" in both scopes. */
  hasGraphContext: boolean
  // chat-scope signals (ignored when scope === 'dashboard')
  /** From resurfacingEngine — the most relevant resurfaced conversation, if any. */
  relatedConversation?: { id: string; title: string } | null
  /** From workspaceInsightEngine's 'most_active' insight — offered only when it isn't already the current workspace. */
  mostActiveWorkspace?: { id: string; name: string } | null
  // dashboard-scope signals (ignored when scope === 'chat')
  /** True when there are memory contradictions or unreviewed memory suggestions to look at. */
  hasMemoryToReview?: boolean
  /** Information Organization score (0-100) — below the threshold, "organize your library" becomes a real recommendation. */
  informationOrganizationScore?: number
  /**
   * AI Experience Intelligence v1 — the most-recently-updated active
   * conversation whose last message role is 'user' (see
   * listLastMessageRoles), i.e. an exchange that never got an assistant
   * reply. Evidence-backed, not a guess: only set when hubData.ts actually
   * observes this, so it's absent (not fabricated) on every ordinary
   * conversation that already got its reply.
   */
  unresolvedConversation?: { id: string; title: string } | null
}

/**
 * UX-8 Phase 6/UX-11 Phase 7's two suggestion engines, unified into one
 * file per the Architecture Consolidation Sprint (docs/ux-14-architecture-
 * consolidation.md, Required Refactor R2). Every recommendation still
 * wraps an existing registry command or an existing per-instance command
 * factory — no new command, no new execution path, no new intelligence.
 * The chat and dashboard branches are unchanged from their original
 * files (same conditions, same reasons, same command ids) — this is a
 * relocation into one canonical module with one exported type, not a
 * behavior change; the dashboard branch's tests (ported unchanged into
 * recommendationEngine.test.ts) verify that directly.
 */
export function generateRecommendations(input: GenerateRecommendationsInput): Recommendation[] {
  return input.scope === 'chat' ? chatRecommendations(input) : dashboardRecommendations(input)
}

function chatRecommendations(input: GenerateRecommendationsInput): Recommendation[] {
  const recommendations: Recommendation[] = deriveActionChips(input.commandContext).map((command) => ({
    category: 'explore',
    command,
    reason: 'Existing capability relevant to this session.',
  }))

  if (input.hasGraphContext) {
    recommendations.push({
      category: 'explore',
      command: openKnowledgeGraphCommand,
      reason: 'Knowledge graph connections contributed to this answer.',
    })
  }

  if (input.relatedConversation) {
    recommendations.push({
      category: 'continue',
      command: buildResumeConversationCommand(input.relatedConversation),
      reason: `A related past conversation ("${input.relatedConversation.title}") may be worth revisiting.`,
    })
  }

  if (input.mostActiveWorkspace && input.mostActiveWorkspace.id !== input.commandContext.workspaceId) {
    const { id, name } = input.mostActiveWorkspace
    recommendations.push({
      category: 'organize',
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

  return recommendations
}

function dashboardRecommendations(input: GenerateRecommendationsInput): Recommendation[] {
  const recommendations: Recommendation[] = []

  const continueReading = buildContinueReadingCommand(input.commandContext)
  if (continueReading) {
    recommendations.push({ category: 'continue', command: continueReading, reason: 'Pick up where you left off.' })
  }

  if (input.unresolvedConversation) {
    recommendations.push({
      category: 'continue',
      command: buildResumeConversationCommand(input.unresolvedConversation),
      reason: "Your last message here didn't get a reply yet.",
    })
  }

  recommendations.push({
    category: 'explore',
    command: createNoteCommand,
    reason: 'Capture a new thought or observation.',
  })

  if (input.hasGraphContext) {
    recommendations.push({
      category: 'explore',
      command: openKnowledgeGraphCommand,
      reason: 'See how your concepts and entities connect.',
    })
  }

  if (input.hasMemoryToReview) {
    recommendations.push({
      category: 'review',
      command: reviewMemorySuggestionsCommand,
      reason: 'Some stored memories may need your attention.',
    })
  } else {
    recommendations.push({
      category: 'review',
      command: manageMemoriesCommand,
      reason: 'Check what NOVA remembers about you.',
    })
  }

  if ((input.informationOrganizationScore ?? 100) < ORGANIZATION_SCORE_THRESHOLD) {
    recommendations.push({
      category: 'organize',
      command: navLibraryCommand,
      reason: 'Several documents are untagged or uncategorized.',
    })
  }

  return recommendations
}
