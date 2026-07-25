import { useQuery } from '@tanstack/react-query'
import { listDocuments, type DocumentFilters } from '@/modules/library/api/documents'
import { useAuth } from '@/modules/auth/useAuth'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'

export function useDocuments(filters: Omit<DocumentFilters, 'workspaceId'>) {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()
  const scopedFilters: DocumentFilters = { ...filters, workspaceId: currentWorkspaceId }

  return useQuery({
    queryKey: ['documents', scopedFilters],
    queryFn: () => listDocuments(scopedFilters),
    enabled: Boolean(user),
  })
}
