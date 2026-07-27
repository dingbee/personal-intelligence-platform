import { useQuery } from '@tanstack/react-query'
import { listNotes, type NoteFilters } from '@/modules/notes/api/notes'
import { useAuth } from '@/modules/auth/useAuth'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'

export function useNotes(filters: Omit<NoteFilters, 'workspaceId'> = {}) {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()
  const scopedFilters: NoteFilters = { ...filters, workspaceId: currentWorkspaceId }

  return useQuery({
    queryKey: ['notes', scopedFilters],
    queryFn: () => listNotes(scopedFilters),
    enabled: Boolean(user),
  })
}
