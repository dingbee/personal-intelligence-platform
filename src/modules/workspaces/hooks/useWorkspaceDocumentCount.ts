import { useQuery } from '@tanstack/react-query'
import { getWorkspaceDocumentCount } from '@/modules/workspaces/api/workspaces'

export function useWorkspaceDocumentCount(workspaceId: string | null) {
  return useQuery({
    queryKey: ['workspace-document-count', workspaceId],
    queryFn: () => getWorkspaceDocumentCount(workspaceId),
  })
}
