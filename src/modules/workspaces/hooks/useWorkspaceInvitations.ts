import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  cancelWorkspaceInvitation,
  inviteToWorkspace,
  listWorkspaceInvitations,
  sendInvitationEmailForResult,
} from '@/modules/workspaces/api/workspaceMembers'
import type { InviteToWorkspaceResult } from '@/modules/workspaces/api/workspaceMembers'
import type { WorkspaceMemberRole } from '@/shared/types/database'

/**
 * UX-14.5.8 Phase 1, extended UX-14.5.8.2 and UX-14.5.8.3 — a workspace's
 * outstanding email-based invitations, for the Collaboration page's
 * "Pending Invitations" list. `useWorkspaceMembers`' own `invite`
 * mutation invalidates this hook's query key on success too, since a
 * successful invite may land here instead of in `workspace_members`
 * depending on whether the invitee already has an account.
 *
 * `cancel` and `resend` are both owner-gated at the database layer
 * (RLS for cancel, `invite_to_workspace`'s own owner check for resend,
 * plus the edge function's own owner check for the email send) — this
 * hook doesn't re-check role, matching every other mutation hook in this
 * module; the UI decides whether to render the buttons at all.
 *
 * `resend` reuses `inviteToWorkspace` (re-inviting the same email/role
 * refreshes the existing row's expiry in place — 0033's `on conflict`
 * clause, unchanged by this phase) and, as of UX-14.5.8.3, also sends a
 * fresh email through the same `sendInvitationEmailForResult` helper
 * `useWorkspaceMembers.invite` uses — genuinely "Resend" now, not just a
 * database refresh. Returns `{ result, emailError }`, not the invitation
 * row, so a delivery failure here can be surfaced without looking like
 * the resend itself failed (the row's expiry/updated_at DID refresh).
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
    mutationFn: async (params: { email: string; role: Exclude<WorkspaceMemberRole, 'owner'> }) => {
      const result = await inviteToWorkspace({ workspaceId, email: params.email, role: params.role })
      const emailError = await sendInvitationEmailForResult(workspaceId, result)
      return { result, emailError } satisfies { result: InviteToWorkspaceResult; emailError: string | null }
    },
    onSuccess: invalidate,
  })

  return { ...query, cancel, resend }
}
