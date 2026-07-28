import { supabase } from '@/shared/lib/supabase'
import type { AiRequest, AiRequestStatus } from '@/shared/types/database'

export interface LogAiRequestParams {
  userId: string
  workspaceId?: string | null
  feature: string
  provider: string
  model?: string | null
  tokensInput?: number | null
  tokensOutput?: number | null
  latencyMs: number
  status: AiRequestStatus
  errorMessage?: string | null
}

/** Best-effort: a logging failure should never break the feature that triggered it. */
export async function logAiRequest(params: LogAiRequestParams): Promise<void> {
  const { error } = await supabase.from('ai_requests').insert({
    user_id: params.userId,
    workspace_id: params.workspaceId ?? null,
    feature: params.feature,
    provider: params.provider,
    model: params.model ?? null,
    tokens_input: params.tokensInput ?? null,
    tokens_output: params.tokensOutput ?? null,
    latency_ms: params.latencyMs,
    status: params.status,
    error_message: params.errorMessage ?? null,
  })
  if (error) console.error('Failed to log AI request:', error)
}

export async function listRecentAiRequests(limit = 20): Promise<AiRequest[]> {
  const { data, error } = await supabase
    .from('ai_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

/**
 * Fetches a bounded recent window for client-side aggregation (AI Health
 * Dashboard) rather than a row-count limit — RLS already scopes this to
 * the current user, and at this table's actual volume a time window is
 * cheap via the existing created_at index. No new index/view/RPC needed;
 * revisit with a real server-side aggregate only if this table grows into
 * the tens of thousands of rows.
 */
export async function listAiRequestsSince(sinceIso: string): Promise<AiRequest[]> {
  const { data, error } = await supabase
    .from('ai_requests')
    .select('*')
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}
