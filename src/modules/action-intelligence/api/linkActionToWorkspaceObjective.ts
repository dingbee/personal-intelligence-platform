import { updateWorkspaceObjectiveContent } from '@/modules/hub/api/objectives'
import type { Action } from '@/modules/action-intelligence/action'
import type { WorkspaceObjective } from '@/shared/types/database'

/**
 * "Link action to existing objective" — Phase 14's third safe hook. There
 * is no dedicated action/objective linking table (Actions aren't persisted
 * anywhere outside a Note — see saveActionSetToNote.ts), so this is
 * implemented as an honest, minimal append onto the objective's own
 * content, using the objective the caller already has loaded (from
 * listWorkspaceObjectives) rather than re-fetching it — never a fabricated
 * relationship, just a visible reference recorded in the objective itself.
 */
export async function linkActionToWorkspaceObjective(params: { objective: WorkspaceObjective; action: Action }): Promise<WorkspaceObjective> {
  const { objective, action } = params
  const reference = `Related action: ${action.title}`
  if (objective.content.includes(reference)) return objective
  const content = `${objective.content}\n\n${reference}`
  return updateWorkspaceObjectiveContent(objective.id, content)
}
