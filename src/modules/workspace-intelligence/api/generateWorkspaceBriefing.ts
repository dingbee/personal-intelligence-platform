import type { CommandContext } from '@/modules/commands/types'
import type { Note } from '@/shared/types/database'
import { getWorkspace } from '@/modules/workspaces/api/workspaces'
import { listWorkspaceObjectives } from '@/modules/hub/api/objectives'
import { buildWorkspaceHubState } from '@/modules/hub/hubData'
import { buildWorkspaceBriefingVariables } from '@/modules/workspace-intelligence/api/workspaceBriefingVariables'
import { createNote } from '@/modules/notes/api/notes'
import { runCapability } from '@/modules/ai/orchestration/runCapability'
import { runWithFallback } from '@/modules/ai/router/runWithFallback'
import { indexNote } from '@/modules/search/indexing/indexNote'
import { linkKnownConceptsToSource } from '@/modules/knowledge-intelligence/api/linkKnownConcepts'
import { withArtifactKind, withCreationMethod } from '@/modules/ai/artifacts/artifactMetadata'

/**
 * Phase P1 Advanced AI Workspace — the first real Pro Intelligence
 * capability. Reuses the exact same execution path as every other
 * capability (runCapability + runWithFallback) and the exact same
 * "persist the output as a real Note" pattern generateBriefing.ts
 * already established for per-concept briefings — this is that same
 * pipeline, scoped to a whole workspace instead of one concept.
 *
 * requiredFeature: 'pro_intelligence' on the registered capability
 * (module.ts) is the only entitlement check — runCapability enforces it
 * server-checked (Phase P0) before this function's prompt/provider
 * resolution or any AI call ever runs. The context fetch above still
 * happens for a denied Free user (it's only ever the caller's own
 * workspace, already RLS-scoped to them — not a privileged read), so
 * this deliberately does not duplicate runCapability's entitlement
 * check just to skip a few reads; one enforcement point stays one
 * enforcement point.
 */
export async function generateWorkspaceBriefing(params: {
  workspaceId: string
  userId: string
  commandContext: CommandContext
  chain: string[]
}): Promise<Note> {
  const { workspaceId, userId, commandContext, chain } = params

  const [workspace, objectives, hub] = await Promise.all([
    getWorkspace(workspaceId),
    listWorkspaceObjectives(workspaceId),
    buildWorkspaceHubState(workspaceId, commandContext),
  ])

  const variables = buildWorkspaceBriefingVariables(workspace, objectives, hub)

  const { result } = await runWithFallback(chain, (candidateId) =>
    runCapability({
      capabilityId: 'workspace-briefing',
      variables,
      userId,
      workspaceId,
      providerId: candidateId,
      requestedProviderId: chain[0],
    }),
  )

  const note = await createNote({
    userId,
    workspaceId,
    title: `Workspace Briefing: ${workspace.name}`,
    content: result.content.trim(),
    generationMetadata: withCreationMethod(withArtifactKind(null, 'briefing'), 'ai_generated'),
  })

  void indexNote(note, workspaceId)
  void linkKnownConceptsToSource({
    userId: note.user_id,
    sourceType: 'note',
    sourceId: note.id,
    text: `${note.title}\n\n${note.content}`,
  })

  return note
}
