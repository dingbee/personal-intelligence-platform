import { useMutation, useQueryClient } from '@tanstack/react-query'
import { authorizeExecution } from '@/modules/execution-foundation/api/authorizeExecution'
import type { ExecutionAuthorizationDecision } from '@/modules/execution-foundation/execution'

/** The Approval Gate's own UI entry point — "Approve" and "Reject" both go through this, never a bare status flip. */
export function useAuthorizeExecution(workspaceId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ executionRequestId, decision }: { executionRequestId: string; decision: ExecutionAuthorizationDecision }) => authorizeExecution({ executionRequestId, decision }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['execution-requests', workspaceId] })
      void queryClient.invalidateQueries({ queryKey: ['execution-request', variables.executionRequestId] })
    },
  })
}
