import { useQuery } from '@tanstack/react-query'
import { listChildRecords } from '@/modules/intelligence-ledger/api/ledgerQueries'

/** What was directly derived from one record (parent_record_id) — the reverse-lineage "what came after this" used on IntelligenceRecordDetailPage.tsx. */
export function useChildRecords(parentRecordId: string | null) {
  return useQuery({
    queryKey: ['intelligence-child-records', parentRecordId],
    queryFn: () => listChildRecords(parentRecordId!),
    enabled: Boolean(parentRecordId),
  })
}
