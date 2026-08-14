import { useMutation, useQueryClient } from '@tanstack/react-query'
import { linkActionToWorkspaceObjective } from '@/modules/action-intelligence/api/linkActionToWorkspaceObjective'
import type { Action } from '@/modules/action-intelligence/action'
import type { WorkspaceObjective } from '@/shared/types/database'

export function useLinkActionToWorkspaceObjective(workspaceId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ objective, action }: { objective: WorkspaceObjective; action: Action }) => linkActionToWorkspaceObjective({ objective, action }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workspace-objectives', workspaceId] })
    },
  })
}
