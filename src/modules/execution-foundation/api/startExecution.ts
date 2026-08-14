import { supabase } from '@/shared/lib/supabase'
import { toExecutionRequest } from '@/modules/execution-foundation/api/mappers'
import type { ExecutionRequest } from '@/modules/execution-foundation/execution'

/** approved -> executing. Re-verified server-side against the most recent approved, unexpired authorization and the request's own unchanged contract hash — see start_execution() in the migration. */
export async function startExecution(executionRequestId: string): Promise<ExecutionRequest> {
  const { data, error } = await supabase.rpc('start_execution', { p_execution_request_id: executionRequestId })
  if (error) throw error
  return toExecutionRequest(data)
}
