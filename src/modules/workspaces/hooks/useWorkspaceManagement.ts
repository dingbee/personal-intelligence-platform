import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import {
  archiveWorkspace,
  createWorkspace,
  deleteWorkspace,
  listWorkspaces,
  renameWorkspace,
  restoreWorkspace,
  swapWorkspaceOrder,
} from '@/modules/workspaces/api/workspaces'
import type { Workspace } from '@/shared/types/database'

/**
 * The management-page counterpart to WorkspaceProvider: that context stays
 * "active workspaces only" (untouched, so the switcher keeps working
 * exactly as before) while this hook fetches everything including
 * archived, for the /settings/workspaces surface.
 */
export function useWorkspaceManagement() {
  const { user } = useAuth()
  const { currentWorkspaceId, setCurrentWorkspaceId } = useWorkspace()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['workspaces', 'all'],
    queryFn: () => listWorkspaces({ includeArchived: true }),
    enabled: Boolean(user),
  })

  // Partial key match invalidates both ['workspaces'] (the switcher's
  // active-only list) and ['workspaces', 'all'] (this hook's list).
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['workspaces'] })

  const create = useMutation({
    mutationFn: (name: string) => createWorkspace({ name, userId: user!.id }),
    onSuccess: (workspace) => {
      invalidate()
      setCurrentWorkspaceId(workspace.id)
    },
  })

  const rename = useMutation({
    mutationFn: (params: { id: string; name: string }) => renameWorkspace(params.id, params.name),
    onSuccess: invalidate,
  })

  const archive = useMutation({
    mutationFn: (id: string) => archiveWorkspace(id),
    onSuccess: (_workspace, id) => {
      invalidate()
      // An archived workspace disappears from the switcher — clear it as
      // "current" so nothing points at a workspace the user can no longer see.
      if (currentWorkspaceId === id) setCurrentWorkspaceId(null)
    },
  })

  const restore = useMutation({
    mutationFn: (id: string) => restoreWorkspace(id),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteWorkspace(id),
    onSuccess: (_result, id) => {
      invalidate()
      if (currentWorkspaceId === id) setCurrentWorkspaceId(null)
    },
  })

  const move = useMutation({
    mutationFn: (params: { direction: 'up' | 'down'; workspace: Workspace }) => {
      const active = (query.data ?? []).filter((w) => !w.archived_at)
      const index = active.findIndex((w) => w.id === params.workspace.id)
      const neighbor = active[params.direction === 'up' ? index - 1 : index + 1]
      if (index === -1 || !neighbor) return Promise.resolve()
      return swapWorkspaceOrder(
        { id: params.workspace.id, sortOrder: params.workspace.sort_order },
        { id: neighbor.id, sortOrder: neighbor.sort_order },
      )
    },
    onSuccess: invalidate,
  })

  return { ...query, create, rename, archive, restore, remove, move }
}
