import { supabase } from '@/shared/lib/supabase'
import { toExecutionRequest } from '@/modules/execution-foundation/api/mappers'
import type { ExecutionRequest } from '@/modules/execution-foundation/execution'

/** Client-driven "this TTL has passed" transition — still server-verified against the request's own expires_at rather than trusted from the caller's clock (see expire_execution() in the migration). */
export async function expireExecution(executionRequestId: string): Promise<ExecutionRequest> {
  const { data, error } = await supabase.rpc('expire_execution', { p_execution_request_id: executionRequestId })
  if (error) throw error
  return toExecutionRequest(data)
}
