import { supabase } from '@/shared/lib/supabase'
import type { WorkspaceMember, WorkspaceMemberRole, WorkspaceMemberStatus } from '@/shared/types/database'

/**
 * UX-14.5 Phase 1 — the one write path for `workspace_members`. Not yet
 * called from any UI: invitations/membership management is explicitly
 * out of scope for this phase, and every new workspace's `owner` row is
 * created automatically by `0028_workspace_members.sql`'s trigger, not
 * this function. This exists so the primitive is fully testable
 * end-to-end and ready for the editor/viewer rows a later phase's
 * invitation flow will create.
 */
export async function createWorkspaceMembership(params: {
  workspaceId: string
  userId: string
  role: WorkspaceMemberRole
  status?: WorkspaceMemberStatus
  invitedBy?: string | null
}): Promise<WorkspaceMember> {
  const { data, error } = await supabase
    .from('workspace_members')
    .insert({
      workspace_id: params.workspaceId,
      user_id: params.userId,
      role: params.role,
      status: params.status ?? 'active',
      invited_by: params.invitedBy ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}
