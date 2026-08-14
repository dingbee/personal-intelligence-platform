import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { addPlanItemAsWorkspaceObjective } from '@/modules/planning-intelligence/api/addPlanItemAsWorkspaceObjective'

export function useAddPlanItemAsWorkspaceObjective(workspaceId: string | null) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ title, description }: { title: string; description: string }) => {
      if (!workspaceId) throw new Error('A workspace is required to add this to workspace objectives.')
      return addPlanItemAsWorkspaceObjective({ userId: user!.id, workspaceId, title, description })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workspace-objectives', workspaceId] })
    },
  })
}
