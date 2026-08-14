import { createWorkspaceObjective } from '@/modules/hub/api/objectives'
import type { WorkspaceObjective } from '@/shared/types/database'

/**
 * "Adding the plan to a workspace" — Phase 8's second action-readiness
 * hook. Reuses the existing workspace_objectives table/API (0021,
 * src/modules/hub/api/objectives.ts) rather than a new "plan item"
 * table: a milestone or task the user chooses to promote into workspace-
 * level tracking is, structurally, exactly what workspace_objectives
 * already models (a short, user-owned, trackable statement with a
 * status). This is a real, working action today, not a stub — it does
 * NOT attempt to keep the objective linked back to the originating plan
 * (the plan itself is only durable once saved via savePlanToNote.ts;
 * see that function's own doc comment on why generation_metadata.plan is
 * the seam a future phase would use to wire richer linking without a
 * schema change).
 */
export async function addPlanItemAsWorkspaceObjective(params: { userId: string; workspaceId: string; title: string; description: string }): Promise<WorkspaceObjective> {
  const { userId, workspaceId, title, description } = params
  const content = description ? `${title} — ${description}` : title
  return createWorkspaceObjective({ userId, workspaceId, content })
}
