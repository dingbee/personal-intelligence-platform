import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { executeCapability } from '@/modules/execution-foundation/api/executeCapability'

/** approved -> executing -> succeeded|failed, including any bounded retries — see executeCapability.ts's own doc comment for the full lifecycle. */
export function useExecuteCapability(workspaceId: string | null) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (executionRequestId: string) => executeCapability({ executionRequestId, userId: user!.id }),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['execution-requests', workspaceId] })
      void queryClient.invalidateQueries({ queryKey: ['execution-request', data.id] })
    },
  })
}
