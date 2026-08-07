import { supabase } from '@/shared/lib/supabase'

/** Start of the current calendar-month period, matching quota_usage.period_start's own `date_trunc('month', now())` default and the consume_quota() RPC's period calculation — both sides must agree on period boundaries or a read taken near a month rollover could disagree with what consume_quota() just wrote. */
function currentPeriodStart(): string {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
}

export const quotaService = {
  async checkQuota(userId: string, quotaKey: string) {
    const { data: assignment, error: assignmentError } = await supabase
      .from('user_plan_assignments')
      .select('plan_id')
      .eq('user_id', userId)
      .eq('active', true)
      .maybeSingle()

    if (assignmentError || !assignment) {
      return {
        allowed: false,
        reason: 'No active plan found',
      }
    }

    const { data: quota, error: quotaError } = await supabase
      .from('plan_quotas')
      .select('quota_limit')
      .eq('plan_id', assignment.plan_id)
      .eq('quota_key', quotaKey)
      .maybeSingle()

    if (quotaError || !quota) {
      return {
        allowed: false,
        reason: 'Quota not configured',
      }
    }

    const { data: usage } = await supabase
      .from('quota_usage')
      .select('usage_count')
      .eq('user_id', userId)
      .eq('quota_key', quotaKey)
      .eq('period_start', currentPeriodStart())
      .maybeSingle()

    const used = usage?.usage_count ?? 0

    return {
      allowed: used < quota.quota_limit,
      used,
      limit: quota.quota_limit,
    }
  },

  /**
   * Routes through the consume_quota() RPC rather than a client-side
   * select-then-update/insert: RLS blocks direct writes to quota_usage
   * (see 0034_beta_invite_quota_repair.sql), and the RPC does the
   * increment as one atomic upsert scoped to the current period,
   * avoiding both the lost-update race and the missing-period-filter bug
   * the old direct-write version had. Resolves the caller via auth.uid()
   * server-side, not the userId argument — kept only so call sites don't
   * need restructuring; the RPC ignores it.
   */
  async consumeQuota(_userId: string, quotaKey: string) {
    const { error } = await supabase.rpc('consume_quota', { p_quota_key: quotaKey })
    if (error) throw error
    return true
  },
}
