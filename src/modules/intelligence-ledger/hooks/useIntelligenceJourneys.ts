import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { listIntelligenceJourneys } from '@/modules/intelligence-ledger/api/ledgerQueries'

/** All journeys for the History page's "Journeys" view. */
export function useIntelligenceJourneys(workspaceId: string | null) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['intelligence-journeys', workspaceId],
    queryFn: () => listIntelligenceJourneys(workspaceId),
    enabled: Boolean(user),
  })
}
