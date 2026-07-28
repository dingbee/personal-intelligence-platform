import { useQuery } from '@tanstack/react-query'
import { getWorkspaceHeaderSummary } from '@/modules/workspaces/api/workspaces'

export function useWorkspaceHeaderSummary(workspaceId: string | null) {
  return useQuery({
    queryKey: ['workspace-header-summary', workspaceId],
    queryFn: () => getWorkspaceHeaderSummary(workspaceId),
  })
}
