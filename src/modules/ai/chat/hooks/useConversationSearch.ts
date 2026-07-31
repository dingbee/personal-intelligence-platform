import { useQuery } from '@tanstack/react-query'
import { searchConversations } from '@/modules/ai/chat/api/conversationSearch'
import { useAuth } from '@/modules/auth/useAuth'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'

/** UX-13.5 Phase 9 — only queries once there's a real query string; an empty query means "not searching," handled by the caller falling back to the normal active/archived list rather than this hook returning everything. */
export function useConversationSearch(query: string, documentId?: string) {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()
  const trimmed = query.trim()

  return useQuery({
    queryKey: ['conversations', 'search', currentWorkspaceId, documentId, trimmed],
    queryFn: () => searchConversations({ userId: user!.id, workspaceId: currentWorkspaceId, documentId, query: trimmed }),
    enabled: Boolean(user) && trimmed.length > 0,
  })
}
