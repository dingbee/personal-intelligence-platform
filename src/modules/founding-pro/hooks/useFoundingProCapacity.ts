import { useQuery } from '@tanstack/react-query'
import { getFoundingProPublicCapacity } from '@/modules/founding-pro/api/foundingPro'

/** Founding Pro Programme Phase 2 — public capacity, safe for both anonymous and authenticated callers. */
export function useFoundingProCapacity() {
  return useQuery({
    queryKey: ['founding-pro-capacity'],
    queryFn: getFoundingProPublicCapacity,
    staleTime: 30 * 1000,
  })
}
