import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  inviteToWorkspace,
  listWorkspaceMembers,
  removeWorkspaceMember,
  updateWorkspaceMemberRole,
} from '@/modules/workspaces/api/workspaceMembers'
import type { WorkspaceMemberRole } from '@/shared/types/database'

/** UX-14.5 Phase 3 — the member-management page's data + mutations for one workspace. */
export function useWorkspaceMembers(workspaceId: string) {
  const queryClient = useQueryClient()
  const queryKey = ['workspace-members', workspaceId]

  const query = useQuery({
    queryKey,
    queryFn: () => listWorkspaceMembers(workspaceId),
    enabled: Boolean(workspaceId),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey })

  const invite = useMutation({
    mutationFn: (params: { email: string; role: Exclude<WorkspaceMemberRole, 'owner'> }) =>
      inviteToWorkspace({ workspaceId, email: params.email, role: params.role }),
    // UX-14.5.8 Phase 1 — a successful invite lands in one of two tables
    // depending on the outcome (see inviteToWorkspace's doc-comment), and
    // the caller doesn't know which ahead of time, so both query keys are
    // invalidated rather than branching on `data.outcome` here.
    onSuccess: () => {
      invalidate()
      queryClient.invalidateQueries({ queryKey: ['workspace-invitations', workspaceId] })
    },
  })

  const changeRole = useMutation({
    mutationFn: (params: { membershipId: string; role: Exclude<WorkspaceMemberRole, 'owner'> }) =>
      updateWorkspaceMemberRole(params.membershipId, params.role),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: (membershipId: string) => removeWorkspaceMember(membershipId),
    onSuccess: invalidate,
  })

  return { ...query, invite, changeRole, remove }
}
