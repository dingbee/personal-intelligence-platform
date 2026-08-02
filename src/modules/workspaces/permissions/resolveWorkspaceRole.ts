import { supabase } from '@/shared/lib/supabase'
import type { WorkspaceMemberRole } from '@/shared/types/database'

/**
 * UX-14.5 Phase 1 — the one source of truth for "what role does this
 * user hold in this workspace," on both the client (here) and inside
 * RLS policies (the SQL `has_workspace_role` helper,
 * `0028_workspace_members.sql`) — both implement the identical two-tier
 * logic so a permission decision never differs between what the UI
 * shows and what the database actually enforces.
 *
 * Tier 1: an explicit active `workspace_members` row for this pair.
 * Tier 2 (fallback): the workspace's own creator (`workspaces.user_id`)
 * is its implicit owner when no explicit row exists — the case for
 * every workspace created before this migration, none of which are
 * backfilled. This fallback is what keeps every existing account's
 * access resolving to exactly today's single-owner behavior with zero
 * data migration (docs/ux-14.5.2 §2.2, §2.4).
 */
export async function resolveWorkspaceRole(workspaceId: string, userId: string): Promise<WorkspaceMemberRole | null> {
  const { data: membership, error: membershipError } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()
  if (membershipError) throw membershipError
  if (membership) return membership.role

  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .select('user_id')
    .eq('id', workspaceId)
    .maybeSingle()
  if (workspaceError) throw workspaceError
  if (workspace?.user_id === userId) return 'owner'

  return null
}
