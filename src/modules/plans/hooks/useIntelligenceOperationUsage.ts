import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { quotaService } from '@/shared/lib/quotaService'

/**
 * Usage Intelligence (Commercial Readiness) — Settings -> Billing's
 * per-engine usage rows, mirroring useAiMessageUsage's own shape exactly
 * (same quotaService.checkQuota resolution, same used/limit contract).
 * One entry per `<engine>_intelligence_operations` quota_key — the same
 * six keys consume_quota's threshold-notification logic watches
 * (0077_quota_threshold_notifications.sql) — with a human-readable
 * `label` so callers never have to know or display the raw quota_key.
 * A plan with no row for a given key (limit resolves to null) is filtered
 * out entirely rather than shown as "0/0" — e.g. Free shows none of
 * these, Student shows five (all but Action Intelligence, which resolves
 * to a real but zero limit and is therefore shown, correctly, as 0/0).
 */
const INTELLIGENCE_OPERATION_LABELS: Record<string, string> = {
  data_intelligence_operations: 'Data Intelligence',
  analysis_intelligence_operations: 'Analysis Intelligence',
  research_intelligence_operations: 'Research Intelligence',
  decision_intelligence_operations: 'Decision Intelligence',
  planning_intelligence_operations: 'Planning Intelligence',
  action_intelligence_operations: 'Action Intelligence',
}

export interface IntelligenceOperationUsageRow {
  quotaKey: string
  label: string
  used: number
  limit: number
}

export function useIntelligenceOperationUsage() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['intelligence-operation-usage', user?.id],
    queryFn: async (): Promise<IntelligenceOperationUsageRow[]> => {
      const entries = Object.entries(INTELLIGENCE_OPERATION_LABELS)
      const results = await Promise.all(entries.map(([key]) => quotaService.checkQuota(user!.id, key)))
      const rows: IntelligenceOperationUsageRow[] = []
      results.forEach((result, i) => {
        const [quotaKey, label] = entries[i]!
        if ('limit' in result && typeof result.limit === 'number') {
          rows.push({ quotaKey, label, used: 'used' in result ? (result.used ?? 0) : 0, limit: result.limit })
        }
      })
      return rows
    },
    enabled: Boolean(user),
    staleTime: 60 * 1000,
  })
}
