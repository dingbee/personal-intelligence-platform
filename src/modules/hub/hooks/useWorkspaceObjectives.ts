import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createWorkspaceObjective,
  deleteWorkspaceObjective,
  listWorkspaceObjectives,
  setWorkspaceObjectiveStatus,
} from '@/modules/hub/api/objectives'
import { useAuth } from '@/modules/auth/useAuth'
import type { WorkspaceObjectiveStatus } from '@/shared/types/database'

/** UX-13.7 — the user-authored objectives checklist for one workspace; null workspaceId (the "All Workspaces" view) has no objectives of its own, so the query stays disabled rather than showing a cross-workspace list. */
export function useWorkspaceObjectives(workspaceId: string | null) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const queryKey = ['workspace-objectives', workspaceId]

  const query = useQuery({
    queryKey,
    queryFn: () => listWorkspaceObjectives(workspaceId!),
    enabled: Boolean(user) && Boolean(workspaceId),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey })

  const create = useMutation({
    mutationFn: (content: string) => createWorkspaceObjective({ userId: user!.id, workspaceId: workspaceId!, content }),
    onSuccess: invalidate,
  })

  const setStatus = useMutation({
    mutationFn: (params: { id: string; status: WorkspaceObjectiveStatus }) =>
      setWorkspaceObjectiveStatus(params.id, params.status),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteWorkspaceObjective(id),
    onSuccess: invalidate,
  })

  return { ...query, create, setStatus, remove }
}
