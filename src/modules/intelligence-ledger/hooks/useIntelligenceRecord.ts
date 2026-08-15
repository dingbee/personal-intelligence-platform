import { useQuery } from '@tanstack/react-query'
import { getIntelligenceRecord } from '@/modules/intelligence-ledger/api/ledgerQueries'

/** One record's full detail — see IntelligenceRecordDetailPage.tsx. */
export function useIntelligenceRecord(recordId: string | null) {
  return useQuery({
    queryKey: ['intelligence-record', recordId],
    queryFn: () => getIntelligenceRecord(recordId!),
    enabled: Boolean(recordId),
  })
}
