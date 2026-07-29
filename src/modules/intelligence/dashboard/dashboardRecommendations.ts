import type { Command, CommandContext } from '@/modules/commands/types'
import { buildContinueReadingCommand } from '@/modules/commands/commands/readerCommands'
import { manageMemoriesCommand, reviewMemorySuggestionsCommand } from '@/modules/commands/commands/memoryCommands'
import { openKnowledgeGraphCommand } from '@/modules/commands/commands/knowledgeCommands'
import { navigationCommands } from '@/modules/commands/commands/navigationCommands'
import { createNoteCommand } from '@/modules/commands/commands/noteCommands'

export type RecommendationCategory = 'explore' | 'review' | 'continue' | 'organize'

export interface DashboardRecommendation {
  category: RecommendationCategory
  command: Command
  reason: string
}

export interface GenerateDashboardRecommendationsInput {
  commandContext: CommandContext
  /** True when this workspace's graph has at least one AI-extracted concept — gates "Explore knowledge graph," same gating condition suggestionEngine.ts already uses. */
  hasGraphContext: boolean
  /** True when there are memory contradictions or unreviewed memory suggestions to look at. */
  hasMemoryToReview: boolean
  /** Information Organization score (0-100) from computeIntelligenceScore — below the threshold, "organize your library" becomes a real recommendation, not just always-on noise. */
  informationOrganizationScore: number
}

const ORGANIZATION_SCORE_THRESHOLD = 70
const navLibraryCommand = navigationCommands.find((command) => command.id === 'nav-library')!

/**
 * UX-11 Phase 7 — every recommendation wraps an existing registry command
 * or an existing per-instance command factory (buildContinueReadingCommand,
 * same pattern as suggestionEngine.ts/graphSuggestions.ts). No new AI
 * action, no new command definition.
 */
export function generateDashboardRecommendations(input: GenerateDashboardRecommendationsInput): DashboardRecommendation[] {
  const recommendations: DashboardRecommendation[] = []

  const continueReading = buildContinueReadingCommand(input.commandContext)
  if (continueReading) {
    recommendations.push({ category: 'continue', command: continueReading, reason: 'Pick up where you left off.' })
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

  if (input.informationOrganizationScore < ORGANIZATION_SCORE_THRESHOLD) {
    recommendations.push({
      category: 'organize',
      command: navLibraryCommand,
      reason: 'Several documents are untagged or uncategorized.',
    })
  }

  return recommendations
}
