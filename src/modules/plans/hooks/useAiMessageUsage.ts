import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { quotaService } from '@/shared/lib/quotaService'

/**
 * Phase 5C — AI message usage/limit for Settings -> Billing, reusing the
 * exact same `resolve_effective_quota_limit`/`quota_usage` resolution the
 * chat send-path's quota gate already enforces (quotaService.checkQuota)
 * — no second usage-computation path. Normalizes checkQuota's
 * allowed/reason failure shape into UsageIndicator's used/limit contract;
 * `limit: null` (its "not available" state) covers both a genuine
 * resolution failure and "no plan configured," matching
 * getStorageUsage's own null-means-unresolved convention.
 */
export function useAiMessageUsage() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['ai-message-usage', user?.id],
    queryFn: async () => {
      const result = await quotaService.checkQuota(user!.id, 'ai_messages')
      if (!('limit' in result) || typeof result.limit !== 'number') return { used: 0, limit: null }
      return { used: 'used' in result ? (result.used ?? 0) : 0, limit: result.limit }
    },
    enabled: Boolean(user),
    staleTime: 60 * 1000,
  })
}
