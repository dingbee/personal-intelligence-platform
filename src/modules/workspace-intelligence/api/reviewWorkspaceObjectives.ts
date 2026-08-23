import type { CommandContext } from '@/modules/commands/types'
import { getWorkspace } from '@/modules/workspaces/api/workspaces'
import { listWorkspaceObjectives } from '@/modules/hub/api/objectives'
import { buildWorkspaceHubState } from '@/modules/hub/hubData'
import { listMemories } from '@/modules/ai/memory/api/memory'
import { profileSource } from '@/modules/ai/memory/profileFields'
import { buildWorkspaceObjectiveReviewVariables } from '@/modules/workspace-intelligence/api/workspaceObjectiveReviewVariables'
import { runCapability } from '@/modules/ai/orchestration/runCapability'
import { runWithFallback } from '@/modules/ai/router/runWithFallback'

/**
 * UX-14.4 — assess active workspace objectives against workspace evidence
 * and the user's explicitly recorded goals. This is advisory only: it
 * never changes an objective's status/content and never creates an action.
 */
export async function reviewWorkspaceObjectives(params: {
  workspaceId: string
  userId: string
  commandContext: CommandContext
  chain: string[]
}): Promise<string> {
  const { workspaceId, userId, commandContext, chain } = params
  const [workspace, objectives, hub, profileMemories] = await Promise.all([
    getWorkspace(workspaceId),
    listWorkspaceObjectives(workspaceId),
    buildWorkspaceHubState(workspaceId, commandContext),
    listMemories({ memoryType: 'explicit_profile', limit: 50 }),
  ])

  const goals = profileMemories.filter((memory) => memory.source === profileSource('goals')).map((memory) => memory.content)
  const variables = buildWorkspaceObjectiveReviewVariables(workspace.name, objectives, hub, goals)
  const { result } = await runWithFallback(chain, (candidateId) =>
    runCapability({
      capabilityId: 'workspace-objective-review',
      variables,
      userId,
      workspaceId,
      providerId: candidateId,
      requestedProviderId: chain[0],
    }),
  )

  return result.content.trim()
}
