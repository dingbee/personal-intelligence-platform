import { useMutation, useQueryClient } from '@tanstack/react-query'
import { buildExecutionContract, type BuildExecutionContractParams } from '@/modules/execution-foundation/api/buildExecutionContract'
import { createExecutionRequest } from '@/modules/execution-foundation/api/createExecutionRequest'

/** ACTION -> EXECUTION REQUEST — the UI's own "propose this" entry point. Building the contract and creating the request are combined here so a caller never has one without the other. */
export function useCreateExecutionRequest(workspaceId: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: BuildExecutionContractParams) => {
      const { contract, source, actionSnapshot } = buildExecutionContract(params)
      return createExecutionRequest({ workspaceId, contract, source, actionSnapshot })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['execution-requests', workspaceId] })
    },
  })
}
