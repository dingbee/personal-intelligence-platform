import { useQuery } from '@tanstack/react-query'
import { listWorkspaceInvitations } from '@/modules/workspaces/api/workspaceMembers'

/**
 * UX-14.5.8 Phase 1 — a workspace's outstanding email-based invitations,
 * for the Collaboration page's "Pending Invitations" list. Read-only
 * this phase (no cancel/resend — UX-14.5.8.2); `useWorkspaceMembers`'
 * own `invite` mutation invalidates this hook's query key on success
 * too, since a successful invite may land here instead of in
 * `workspace_members` depending on whether the invitee already has an
 * account.
 */
export function useWorkspaceInvitations(workspaceId: string) {
  return useQuery({
    queryKey: ['workspace-invitations', workspaceId],
    queryFn: () => listWorkspaceInvitations(workspaceId),
    enabled: Boolean(workspaceId),
  })
}
