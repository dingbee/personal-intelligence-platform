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
  /** Phase 8C: the router's first-choice candidate for this request — pass it even when it matches `provider` (no fallback happened), so "routed, first try succeeded" is distinguishable from "not routed at all." */
  requestedProvider?: string | null
  /** Set only when `provider` differs from `requestedProvider`. */
  fallbackReason?: string | null
  /** Operation Budget Foundation — groups this row with every other AI call belonging to the same intelligence operation (see src/shared/lib/intelligenceOperations.ts). Null for calls with no operation context. */
  operationId?: string | null
  operationType?: string | null
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
    requested_provider: params.requestedProvider ?? null,
    fallback_reason: params.fallbackReason ?? null,
    operation_id: params.operationId ?? null,
    operation_type: params.operationType ?? null,
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

/**
 * The Control Center's "last test" history — deliberately the mirror image
 * of useAiHealth's exclusion of feature='provider-test': this is the one
 * place that *only* wants those rows, so a manual connectivity test still
 * has somewhere to be seen after a page reload, without polluting the
 * health/usage aggregations built on listAiRequestsSince.
 */
export async function listRecentProviderTests(limit = 50): Promise<AiRequest[]> {
  const { data, error } = await supabase
    .from('ai_requests')
    .select('*')
    .eq('feature', 'provider-test')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}
