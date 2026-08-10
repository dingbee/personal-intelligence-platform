import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { getMyFoundingProMembership, getMyLatestFoundingProApplication } from '@/modules/founding-pro/api/foundingPro'

/** The caller's own Founding Pro membership row, if any. `data` is `null` for anyone who isn't a Founding Pro member. */
export function useMyFoundingProMembership() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['my-founding-pro-membership', user?.id],
    queryFn: () => getMyFoundingProMembership(user!.id),
    enabled: Boolean(user),
    staleTime: 60 * 1000,
  })
}

/** The caller's own most recent Founding Pro application, if any (may be rejected/withdrawn — see resolveFoundingProDisplayState for how status is interpreted). */
export function useMyLatestFoundingProApplication() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['my-latest-founding-pro-application', user?.id],
    queryFn: () => getMyLatestFoundingProApplication(user!.id),
    enabled: Boolean(user),
    staleTime: 30 * 1000,
  })
}
