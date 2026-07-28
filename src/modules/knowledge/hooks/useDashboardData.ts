import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import {
  listDocumentConnections,
  listFlashcardActivity,
  listRecentChapterSummaries,
  listRecentHighlights,
} from '@/modules/knowledge/api/dashboard'

export function useRecentHighlights(limit = 5) {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()
  return useQuery({
    queryKey: ['recent-highlights', currentWorkspaceId, limit],
    queryFn: () => listRecentHighlights(currentWorkspaceId, limit),
    enabled: Boolean(user),
  })
}

export function useRecentChapterSummaries(limit = 5) {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()
  return useQuery({
    queryKey: ['recent-chapter-summaries', currentWorkspaceId, limit],
    queryFn: () => listRecentChapterSummaries(currentWorkspaceId, limit),
    enabled: Boolean(user),
  })
}

export function useFlashcardActivity() {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()
  return useQuery({
    queryKey: ['flashcard-activity', currentWorkspaceId],
    queryFn: () => listFlashcardActivity(currentWorkspaceId),
    enabled: Boolean(user),
  })
}

export function useDocumentConnections(limit = 8) {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()
  return useQuery({
    queryKey: ['document-connections', currentWorkspaceId, limit],
    queryFn: () => listDocumentConnections(currentWorkspaceId, limit),
    enabled: Boolean(user),
  })
}
