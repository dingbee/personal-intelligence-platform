import { supabase } from '@/shared/lib/supabase'
import { toExecutionAuthorization } from '@/modules/execution-foundation/api/mappers'
import type { ExecutionAuthorization, ExecutionAuthorizationDecision } from '@/modules/execution-foundation/execution'

/**
 * The Approval Gate (sprint brief Phase 5): ACTION READY != ACTION
 * AUTHORIZED. This is the only path by which a request becomes
 * 'approved'/'rejected' — the actual enforcement (ownership, valid
 * source status, expiry) lives in authorize_execution_request() itself,
 * a SECURITY DEFINER RPC a client cannot bypass by writing to
 * execution_requests directly (see the migration's own grants).
 */
export async function authorizeExecution(params: {
  executionRequestId: string
  decision: ExecutionAuthorizationDecision
  scope?: Record<string, unknown>
  expiresAt?: string | null
}): Promise<ExecutionAuthorization> {
  const { executionRequestId, decision, scope = {}, expiresAt = null } = params
  const { data, error } = await supabase.rpc('authorize_execution_request', {
    p_execution_request_id: executionRequestId,
    p_decision: decision,
    p_scope: scope,
    p_expires_at: expiresAt,
  })
  if (error) throw error
  return toExecutionAuthorization(data)
}
