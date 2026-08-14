import { supabase } from '@/shared/lib/supabase'
import { toExecutionRequest } from '@/modules/execution-foundation/api/mappers'
import type { ExecutionRequest } from '@/modules/execution-foundation/execution'

export async function cancelExecution(executionRequestId: string, reason?: string): Promise<ExecutionRequest> {
  const { data, error } = await supabase.rpc('cancel_execution', { p_execution_request_id: executionRequestId, p_reason: reason ?? null })
  if (error) throw error
  return toExecutionRequest(data)
}
