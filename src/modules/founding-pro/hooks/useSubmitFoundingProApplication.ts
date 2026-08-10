import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { submitFoundingProApplication } from '@/modules/founding-pro/api/foundingPro'

/** Submits the caller's own Founding Pro application and refreshes the queries that display application/capacity state. */
export function useSubmitFoundingProApplication() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: submitFoundingProApplication,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-latest-founding-pro-application', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['founding-pro-capacity'] })
    },
  })
}
