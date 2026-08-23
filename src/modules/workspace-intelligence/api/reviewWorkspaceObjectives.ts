import type { CommandContext } from '@/modules/commands/types'
import { getWorkspace } from '@/modules/workspaces/api/workspaces'
import { listWorkspaceObjectives } from '@/modules/hub/api/objectives'
import { buildWorkspaceHubState } from '@/modules/hub/hubData'
import { buildWorkspaceObjectiveReviewVariables } from '@/modules/workspace-intelligence/api/workspaceObjectiveReviewVariables'
import { runCapability } from '@/modules/ai/orchestration/runCapability'
import { runWithFallback } from '@/modules/ai/router/runWithFallback'

/**
 * UX-14.4 — assess active workspace objectives against the workspace's
 * existing deterministic state. This is advisory only: it never changes
 * an objective's status or content and never creates an action.
 */
export async function reviewWorkspaceObjectives(params: {
  workspaceId: string
  userId: string
  commandContext: CommandContext
  chain: string[]
}): Promise<string> {
  const { workspaceId, userId, commandContext, chain } = params
  const [workspace, objectives, hub] = await Promise.all([
    getWorkspace(workspaceId),
    listWorkspaceObjectives(workspaceId),
    buildWorkspaceHubState(workspaceId, commandContext),
  ])

  const variables = buildWorkspaceObjectiveReviewVariables(workspace.name, objectives, hub)
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
