import { useQuery } from '@tanstack/react-query'
import { listRecentAiRequests } from '@/modules/ai/observability/api/aiRequests'
import { useAuth } from '@/modules/auth/useAuth'

export function useRecentAiRequests(limit = 20) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['ai-requests', limit],
    queryFn: () => listRecentAiRequests(limit),
    enabled: Boolean(user),
  })
}
