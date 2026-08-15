import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { listIntelligenceRecords } from '@/modules/intelligence-ledger/api/ledgerQueries'

/** The History timeline's own data source — reverse-chronological, RLS-scoped. See HistoryPage.tsx. */
export function useIntelligenceRecords(workspaceId: string | null) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['intelligence-records', workspaceId],
    queryFn: () => listIntelligenceRecords(workspaceId),
    enabled: Boolean(user),
  })
}
