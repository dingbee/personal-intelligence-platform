import type { WorkspaceObjective } from '@/shared/types/database'
import type { WorkspaceHubState } from '@/modules/hub/hubData'

export function buildWorkspaceObjectiveReviewVariables(
  workspaceName: string,
  objectives: WorkspaceObjective[],
  hub: WorkspaceHubState,
  goals: string[] = [],
): {
  workspaceName: string
  userGoals: string
  activeObjectives: string
  completedObjectives: string
  recentActivity: string
  established: string
  unresolved: string
  recommendedNext: string
} {
  const active = objectives.filter((objective) => objective.status === 'active')
  const done = objectives.filter((objective) => objective.status === 'done')
  const activeObjectives = active.length > 0 ? active.map((objective) => `- ${objective.content}`).join('\n') : 'None recorded.'
  const completedObjectives = done.length > 0 ? done.map((objective) => `- ${objective.content}`).join('\n') : 'None recorded.'
  const userGoals = goals.length > 0 ? goals.map((goal) => `- ${goal}`).join('\n') : 'No explicit user goals recorded.'
  const recentActivityLines = [
    ...hub.recentNotes.map((note) => `- Note: ${note.title || 'Untitled note'}`),
    ...hub.activeConversations.map((conversation) => `- Conversation: ${conversation.title || 'Untitled conversation'}`),
  ]
  const recentActivity = recentActivityLines.length > 0 ? recentActivityLines.join('\n') : 'No recent activity recorded.'
  const established = [
    `${hub.report.maturity.label} — ${hub.report.maturity.reason}`,
    ...hub.activeConcepts.slice(0, 10).map((concept) => `- ${concept.title} (${concept.status})`),
  ].join('\n')
  const unresolved = hub.gaps.length > 0 ? hub.gaps.map((gap) => `- ${gap.message}`).join('\n') : 'No open knowledge gaps recorded.'
  const recommendedNext = hub.recommendations.length > 0
    ? hub.recommendations.slice(0, 5).map((recommendation) => `- ${recommendation.reason}`).join('\n')
    : 'No specific recommendation available yet.'

  return { workspaceName, userGoals, activeObjectives, completedObjectives, recentActivity, established, unresolved, recommendedNext }
}
