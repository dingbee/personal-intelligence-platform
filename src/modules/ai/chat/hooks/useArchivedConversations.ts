import { useQuery } from '@tanstack/react-query'
import { listArchivedConversations } from '@/modules/ai/chat/api/conversations'
import { useAuth } from '@/modules/auth/useAuth'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'

/**
 * UX-13.5B — the archive view. Query key deliberately starts with the same
 * 'conversations' prefix useConversations' active-list query uses, so
 * that hook's `invalidate()` (a prefix match on ['conversations']) also
 * refreshes this list — archiving/restoring a conversation moves it
 * between the two lists without either hook needing to know about the
 * other's query key directly.
 */
export function useArchivedConversations(documentId?: string) {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()

  return useQuery({
    queryKey: ['conversations', 'archived', currentWorkspaceId, documentId],
    queryFn: () => listArchivedConversations({ workspaceId: currentWorkspaceId, documentId }),
    enabled: Boolean(user),
  })
}
