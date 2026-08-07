import { supabase } from '@/shared/lib/supabase'

export interface CurrentUserPlan {
  planId: string
  planCode: string
  planName: string
}

/**
 * Resolves the caller's own active plan code/name — quotaService.ts only
 * ever needed `plan_id` (to join into plan_quotas for a limit), so this is
 * the one piece of "what plan am I actually on" resolution the app never
 * had before provider entitlements needed it. RLS on both tables is
 * SELECT-only-own-row/public-read respectively (0034_beta_invite_quota_
 * repair.sql), so this never needs to go through an RPC.
 */
export async function getCurrentUserPlan(userId: string): Promise<CurrentUserPlan | null> {
  const { data: assignment } = await supabase
    .from('user_plan_assignments')
    .select('plan_id')
    .eq('user_id', userId)
    .eq('active', true)
    .maybeSingle()

  if (!assignment) return null

  const { data: plan } = await supabase.from('plans').select('id, code, name').eq('id', assignment.plan_id).maybeSingle()

  if (!plan) return null

  return { planId: plan.id, planCode: plan.code, planName: plan.name }
}
