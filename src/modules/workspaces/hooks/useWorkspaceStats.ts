import { useQuery } from '@tanstack/react-query'
import { getWorkspaceStats } from '@/modules/workspaces/api/workspaces'

export function useWorkspaceStats(workspaceId: string | null) {
  return useQuery({
    queryKey: ['workspace-stats', workspaceId],
    queryFn: () => getWorkspaceStats(workspaceId!),
    enabled: Boolean(workspaceId),
  })
}
