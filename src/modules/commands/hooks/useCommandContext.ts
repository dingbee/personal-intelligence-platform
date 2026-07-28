import { useLocation, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { getMostRecentReadingProgress } from '@/modules/reader/api/readingProgress'
import type { CommandContext } from '@/modules/commands/types'

/** Resolves "here and now" for commands' isAvailable/execute — see CommandContext. */
export function useCommandContext(): CommandContext {
  const { user } = useAuth()
  const { currentWorkspaceId, workspaces } = useWorkspace()
  const location = useLocation()
  const params = useParams<{ documentId?: string }>()

  const { data: inProgressDocument = null } = useQuery({
    queryKey: ['most-recent-reading-progress'],
    queryFn: getMostRecentReadingProgress,
    enabled: Boolean(user),
    staleTime: 5 * 60 * 1000,
  })

  const currentWorkspace = workspaces.find((workspace) => workspace.id === currentWorkspaceId)

  return {
    userId: user?.id ?? '',
    workspaceId: currentWorkspaceId,
    workspaceName: currentWorkspace?.name ?? null,
    pathname: location.pathname,
    documentId: params.documentId ?? null,
    inProgressDocument,
  }
}
