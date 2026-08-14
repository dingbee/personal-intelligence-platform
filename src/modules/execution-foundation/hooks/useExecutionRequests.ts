import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { listExecutionRequests } from '@/modules/execution-foundation/api/executionQueries'

export function useExecutionRequests(workspaceId: string | null) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['execution-requests', workspaceId],
    queryFn: () => listExecutionRequests(workspaceId),
    enabled: Boolean(user),
  })
}
