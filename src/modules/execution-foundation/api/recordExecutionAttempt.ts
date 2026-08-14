import { supabase } from '@/shared/lib/supabase'
import { toExecutionAttempt } from '@/modules/execution-foundation/api/mappers'
import type { ExecutionAttempt, ExecutionFailureKind } from '@/modules/execution-foundation/execution'
import type { ExecutionAttemptOutcomeValue } from '@/shared/types/database'

export async function recordExecutionAttempt(params: {
  executionRequestId: string
  outcome: ExecutionAttemptOutcomeValue
  failureKind?: ExecutionFailureKind | null
  failureMessage?: string | null
  result?: Record<string, unknown> | null
  isFinal: boolean
}): Promise<ExecutionAttempt> {
  const { executionRequestId, outcome, failureKind = null, failureMessage = null, result = null, isFinal } = params
  const { data, error } = await supabase.rpc('record_execution_attempt', {
    p_execution_request_id: executionRequestId,
    p_outcome: outcome,
    p_failure_kind: failureKind,
    p_failure_message: failureMessage,
    p_result: result,
    p_is_final: isFinal,
  })
  if (error) throw error
  return toExecutionAttempt(data)
}
