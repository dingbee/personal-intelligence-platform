import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { addActionAsWorkspaceObjective } from '@/modules/action-intelligence/api/addActionAsWorkspaceObjective'
import type { Action } from '@/modules/action-intelligence/action'

export function useAddActionAsWorkspaceObjective(workspaceId: string | null) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (action: Action) => {
      if (!workspaceId) throw new Error('A workspace is required to add this to workspace objectives.')
      return addActionAsWorkspaceObjective({ userId: user!.id, workspaceId, action })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workspace-objectives', workspaceId] })
    },
  })
}
