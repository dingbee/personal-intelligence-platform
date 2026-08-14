import { supabase } from '@/shared/lib/supabase'
import { toExecutionAttempt, toExecutionAuditEvent, toExecutionAuthorization, toExecutionRequest } from '@/modules/execution-foundation/api/mappers'
import type { ExecutionAttempt, ExecutionAuditEvent, ExecutionAuthorization, ExecutionRequest } from '@/modules/execution-foundation/execution'

/** RLS scopes every one of these to the caller's own rows — see the four select policies in 0065_execution_foundation.sql. */
export async function listExecutionRequests(workspaceId: string | null): Promise<ExecutionRequest[]> {
  let query = supabase.from('execution_requests').select('*').order('created_at', { ascending: false })
  query = workspaceId ? query.eq('workspace_id', workspaceId) : query.is('workspace_id', null)
  const { data, error } = await query
  if (error) throw error
  return data.map(toExecutionRequest)
}

export async function getExecutionRequest(id: string): Promise<ExecutionRequest> {
  const { data, error } = await supabase.from('execution_requests').select('*').eq('id', id).single()
  if (error) throw error
  return toExecutionRequest(data)
}

export async function listExecutionAuthorizations(executionRequestId: string): Promise<ExecutionAuthorization[]> {
  const { data, error } = await supabase.from('execution_authorizations').select('*').eq('execution_request_id', executionRequestId).order('created_at', { ascending: true })
  if (error) throw error
  return data.map(toExecutionAuthorization)
}

export async function listExecutionAttempts(executionRequestId: string): Promise<ExecutionAttempt[]> {
  const { data, error } = await supabase.from('execution_attempts').select('*').eq('execution_request_id', executionRequestId).order('attempt_number', { ascending: true })
  if (error) throw error
  return data.map(toExecutionAttempt)
}

export async function listExecutionAuditEvents(executionRequestId: string): Promise<ExecutionAuditEvent[]> {
  const { data, error } = await supabase.from('execution_audit_events').select('*').eq('execution_request_id', executionRequestId).order('created_at', { ascending: true })
  if (error) throw error
  return data.map(toExecutionAuditEvent)
}
