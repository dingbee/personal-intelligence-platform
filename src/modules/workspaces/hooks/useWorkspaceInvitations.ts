import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { cancelWorkspaceInvitation, inviteToWorkspace, listWorkspaceInvitations } from '@/modules/workspaces/api/workspaceMembers'
import type { WorkspaceMemberRole } from '@/shared/types/database'

/**
 * UX-14.5.8 Phase 1, extended UX-14.5.8.2 — a workspace's outstanding
 * email-based invitations, for the Collaboration page's "Pending
 * Invitations" list. `useWorkspaceMembers`' own `invite` mutation
 * invalidates this hook's query key on success too, since a successful
 * invite may land here instead of in `workspace_members` depending on
 * whether the invitee already has an account.
 *
 * `cancel` and `resend` are both owner-gated at the database layer
 * (RLS for cancel, `invite_to_workspace`'s own owner check for resend) —
 * this hook doesn't re-check role, matching every other mutation hook
 * in this module; the UI decides whether to render the buttons at all.
 * `resend` deliberately reuses `inviteToWorkspace` rather than a
 * dedicated function: re-inviting the same email/role is exactly what
 * "resend" means today (refresh the expiry, re-affirm who's inviting —
 * see `0033_workspace_invitation_management.sql`'s header for why
 * that's an honest description before real email delivery exists).
 */
export function useWorkspaceInvitations(workspaceId: string) {
  const queryClient = useQueryClient()
  const queryKey = ['workspace-invitations', workspaceId]

  const query = useQuery({
    queryKey,
    queryFn: () => listWorkspaceInvitations(workspaceId),
    enabled: Boolean(workspaceId),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey })

  const cancel = useMutation({
    mutationFn: (invitationId: string) => cancelWorkspaceInvitation(invitationId),
    onSuccess: invalidate,
  })

  const resend = useMutation({
    mutationFn: (params: { email: string; role: Exclude<WorkspaceMemberRole, 'owner'> }) =>
      inviteToWorkspace({ workspaceId, email: params.email, role: params.role }),
    onSuccess: invalidate,
  })

  return { ...query, cancel, resend }
}
