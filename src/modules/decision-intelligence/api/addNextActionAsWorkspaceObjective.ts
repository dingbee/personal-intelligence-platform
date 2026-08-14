import { createWorkspaceObjective } from '@/modules/hub/api/objectives'
import type { WorkspaceObjective } from '@/shared/types/database'

/**
 * "Add recommended next action to Workspace Objectives" — Phase 13's
 * second action-readiness hook, mirroring
 * addPlanItemAsWorkspaceObjective.ts exactly: reuses the existing
 * workspace_objectives table/API rather than a new task-management
 * system (explicitly forbidden by the sprint brief's non-negotiable
 * rule #7 — no autonomous execution — and rule "do not create a new
 * task-management system").
 */
export async function addNextActionAsWorkspaceObjective(params: { userId: string; workspaceId: string; nextAction: string }): Promise<WorkspaceObjective> {
  const { userId, workspaceId, nextAction } = params
  return createWorkspaceObjective({ userId, workspaceId, content: nextAction })
}
