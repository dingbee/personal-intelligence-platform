import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { addNextActionAsWorkspaceObjective } from '@/modules/decision-intelligence/api/addNextActionAsWorkspaceObjective'

export function useAddNextActionAsWorkspaceObjective(workspaceId: string | null) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (nextAction: string) => {
      if (!workspaceId) throw new Error('A workspace is required to add this to workspace objectives.')
      return addNextActionAsWorkspaceObjective({ userId: user!.id, workspaceId, nextAction })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workspace-objectives', workspaceId] })
    },
  })
}
