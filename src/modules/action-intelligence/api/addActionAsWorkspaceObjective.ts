import { createWorkspaceObjective } from '@/modules/hub/api/objectives'
import type { Action } from '@/modules/action-intelligence/action'
import type { WorkspaceObjective } from '@/shared/types/database'

/**
 * "Add action as Workspace Objective" — Phase 14's second action-readiness
 * hook, mirroring addNextActionAsWorkspaceObjective.ts exactly: reuses the
 * existing workspace_objectives table/API rather than a new task-management
 * system (the sprint brief's own explicit prohibition on inventing one).
 */
export async function addActionAsWorkspaceObjective(params: { userId: string; workspaceId: string; action: Action }): Promise<WorkspaceObjective> {
  const { userId, workspaceId, action } = params
  const content = action.description ? `${action.title} — ${action.description}` : action.title
  return createWorkspaceObjective({ userId, workspaceId, content })
}
