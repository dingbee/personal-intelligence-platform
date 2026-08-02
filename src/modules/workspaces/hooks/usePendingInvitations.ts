import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { listMyPendingInvitations, respondToWorkspaceInvitation } from '@/modules/workspaces/api/workspaceMembers'

/** UX-14.5 Phase 3 — the current user's own pending invitations, and accepting/declining them. */
export function usePendingInvitations() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const queryKey = ['pending-invitations']

  const query = useQuery({
    queryKey,
    queryFn: () => listMyPendingInvitations(),
    enabled: Boolean(user),
  })

  const respond = useMutation({
    mutationFn: (params: { membershipId: string; accept: boolean }) =>
      respondToWorkspaceInvitation(params.membershipId, params.accept),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
      // Accepting makes a new workspace visible in the switcher — listWorkspaces()
      // defers entirely to RLS, so the switcher's own list needs invalidating too.
      queryClient.invalidateQueries({ queryKey: ['workspaces'] })
    },
  })

  return { ...query, respond }
}
