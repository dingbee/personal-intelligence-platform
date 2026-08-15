import { useQuery } from '@tanstack/react-query'
import { getIntelligenceJourney } from '@/modules/intelligence-ledger/api/ledgerQueries'

/** One journey's own metadata — see IntelligenceJourneyDetailPage.tsx. */
export function useIntelligenceJourney(journeyId: string | null) {
  return useQuery({
    queryKey: ['intelligence-journey', journeyId],
    queryFn: () => getIntelligenceJourney(journeyId!),
    enabled: Boolean(journeyId),
  })
}
