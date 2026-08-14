import { useMutation, useQueryClient } from '@tanstack/react-query'
import { cancelExecution } from '@/modules/execution-foundation/api/cancelExecution'

export function useCancelExecution(workspaceId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ executionRequestId, reason }: { executionRequestId: string; reason?: string }) => cancelExecution(executionRequestId, reason),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['execution-requests', workspaceId] })
      void queryClient.invalidateQueries({ queryKey: ['execution-request', data.id] })
    },
  })
}
