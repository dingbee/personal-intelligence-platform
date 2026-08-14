import { useQuery } from '@tanstack/react-query'
import { getExecutionRequest, listExecutionAttempts, listExecutionAuditEvents, listExecutionAuthorizations } from '@/modules/execution-foundation/api/executionQueries'

/** Everything the Execution UI needs to review one request: the request itself, its authorization(s), its attempt history, and its audit trail — see ExecutionsPage.tsx. */
export function useExecutionRequestDetail(executionRequestId: string | null) {
  return useQuery({
    queryKey: ['execution-request', executionRequestId],
    queryFn: async () => {
      const [request, authorizations, attempts, auditEvents] = await Promise.all([
        getExecutionRequest(executionRequestId!),
        listExecutionAuthorizations(executionRequestId!),
        listExecutionAttempts(executionRequestId!),
        listExecutionAuditEvents(executionRequestId!),
      ])
      return { request, authorizations, attempts, auditEvents }
    },
    enabled: Boolean(executionRequestId),
  })
}
