import { useQuery } from '@tanstack/react-query'
import { listJourneyRecords } from '@/modules/intelligence-ledger/api/ledgerQueries'

/** Every record belonging to one journey, in creation order — the chain IntelligenceJourneyDetailPage.tsx walks. */
export function useJourneyRecords(journeyId: string | null) {
  return useQuery({
    queryKey: ['intelligence-journey-records', journeyId],
    queryFn: () => listJourneyRecords(journeyId!),
    enabled: Boolean(journeyId),
  })
}
