import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { resolveWorkspaceRole } from '@/modules/workspaces/permissions/resolveWorkspaceRole'

/**
 * UX-14.5 Phase 2 — the first UI consumer of Phase 1's
 * resolveWorkspaceRole. `workspaceId: null` (a note/object with no
 * workspace at all) resolves to `null` with no query — there's no
 * workspace role to resolve, so callers combine this with their own
 * row-ownership check (e.g. `note.user_id === user.id`) rather than
 * treating a null role as "no access."
 */
export function useWorkspaceRole(workspaceId: string | null) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['workspace-role', workspaceId, user?.id],
    queryFn: () => resolveWorkspaceRole(workspaceId!, user!.id),
    enabled: Boolean(workspaceId) && Boolean(user),
  })
}
