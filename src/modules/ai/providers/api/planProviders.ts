import { supabase } from '@/shared/lib/supabase'

export interface PlanProviderAllocation {
  providerId: string
  priority: number
}

/**
 * Phase 5A — the caller's own plan's allowed-AI-provider set
 * (`plan_ai_providers`, active rows only), ordered by admin-configured
 * priority. This is the data `resolveProviderChain` filters candidacy
 * against — never exposed as display text anywhere (provider_id, not a
 * label), and RLS scopes reads to what the plan_id join actually returns,
 * not to the caller's own identity, since the set itself carries no
 * per-user information.
 */
export async function listPlanAiProviders(planId: string): Promise<PlanProviderAllocation[]> {
  const { data, error } = await supabase
    .from('plan_ai_providers')
    .select('provider_id, priority')
    .eq('plan_id', planId)
    .eq('active', true)
    .order('priority', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => ({ providerId: row.provider_id, priority: row.priority }))
}
