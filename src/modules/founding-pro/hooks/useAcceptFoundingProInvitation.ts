import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { acceptFoundingProInvitation } from '@/modules/founding-pro/api/foundingPro'

/**
 * Founding Pro Programme Phase 4 — accepts the caller's own pending
 * invitation, triggering atomic enrollment server-side. Refreshes every
 * query the resulting state change affects: the invitation itself (now
 * accepted), the membership (now exists), the application (now
 * enrolled), and the public capacity counter (now one lower).
 */
export function useAcceptFoundingProInvitation() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: acceptFoundingProInvitation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-pending-founding-pro-invitation', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['my-founding-pro-membership', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['my-latest-founding-pro-application', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['founding-pro-capacity'] })
    },
  })
}
