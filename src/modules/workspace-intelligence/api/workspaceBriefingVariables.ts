import type { Workspace, WorkspaceObjective } from '@/shared/types/database'
import type { WorkspaceHubState } from '@/modules/hub/hubData'

/**
 * Phase P1 Advanced AI Workspace — pure formatting of already-fetched
 * workspace state (the same WorkspaceHubState the Hub page itself
 * renders, plus the workspace's own name/objectives) into the variables
 * the workspace-briefing prompt template expects. No I/O, no new
 * computation — mirrors buildBriefingVariables' role for generate-briefing
 * exactly, just scoped to a whole workspace instead of one concept.
 */
export function buildWorkspaceBriefingVariables(
  workspace: Workspace,
  objectives: WorkspaceObjective[],
  hub: WorkspaceHubState,
): {
  workspaceName: string
  objectives: string
  recentActivity: string
  established: string
  unresolved: string
  recommendedNext: string
} {
  const activeObjectives = objectives.filter((objective) => objective.status === 'active')
  const objectivesText = activeObjectives.length > 0 ? activeObjectives.map((objective) => `- ${objective.content}`).join('\n') : 'None recorded.'

  const recentActivityLines = [
    ...hub.recentNotes.map((note) => `- Note: ${note.title || 'Untitled note'}`),
    ...hub.activeConversations.map((conversation) => `- Conversation: ${conversation.title || 'Untitled conversation'}`),
  ]
  const recentActivity = recentActivityLines.length > 0 ? recentActivityLines.join('\n') : 'No recent activity recorded.'

  const establishedLines = [
    `${hub.report.maturity.label} — ${hub.report.maturity.reason}`,
    ...hub.activeConcepts.slice(0, 10).map((concept) => `- ${concept.title} (${concept.status})`),
  ]
  const established = establishedLines.join('\n')

  const unresolved = hub.gaps.length > 0 ? hub.gaps.map((gap) => `- ${gap.message}`).join('\n') : 'No open knowledge gaps recorded.'

  const recommendedNext =
    hub.recommendations.length > 0
      ? hub.recommendations
          .slice(0, 5)
          .map((recommendation) => `- ${recommendation.reason}`)
          .join('\n')
      : 'No specific recommendation available yet.'

  return {
    workspaceName: workspace.name,
    objectives: objectivesText,
    recentActivity,
    established,
    unresolved,
    recommendedNext,
  }
}
