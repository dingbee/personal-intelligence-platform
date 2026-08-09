import { supabase } from '@/shared/lib/supabase'

/** Start of the current calendar-month period, matching quota_usage.period_start's own `date_trunc('month', now())` default and the consume_quota() RPC's period calculation — both sides must agree on period boundaries or a read taken near a month rollover could disagree with what consume_quota() just wrote. */
function currentPeriodStart(): string {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
}

export const quotaService = {
  /**
   * ARRIYIA Quota Administration Remediation — the plan-lookup +
   * quota-lookup this used to do inline (two separate queries, hand-rolled)
   * is now one call to resolve_effective_quota_limit(), the single
   * authoritative place that computes effective_limit = coalesce(personal
   * override, plan default) — see 0041_user_quota_overrides.sql. This is
   * the same formula consume_quota() now delegates to as well, so the
   * limit checkQuota reports and the limit consume_quota() enforces can
   * never drift apart. "No active plan" and "plan has no quota configured
   * for this key" collapse into one honest, still fail-closed reason
   * (both are equally "this account cannot use AI messages right now");
   * the usage-count read below is unrelated to limit resolution (a plain
   * own-row read, not a computation), so it's unchanged from before.
   */
  async checkQuota(userId: string, quotaKey: string) {
    const { data: effectiveLimit, error: limitError } = await supabase.rpc('resolve_effective_quota_limit', {
      p_user_id: userId,
      p_quota_key: quotaKey,
    })

    // PIP Sprint 8/10 — a genuine query failure here (network blip, RLS
    // misconfiguration) previously produced the exact same message as a
    // user who legitimately has no plan, telling them to sign up when the
    // real problem was an infrastructure error. Still fails closed
    // (allowed: false either way — never risk unmetered usage on an
    // unverifiable check), but the reason now tells the truth about which
    // case actually happened, and the real error is logged for diagnosis.
    if (limitError) {
      console.error('checkQuota: quota resolution failed:', limitError)
      return {
        allowed: false,
        reason: 'Could not verify your plan — please try again.',
      }
    }
    if (effectiveLimit === null) {
      return {
        allowed: false,
        reason: 'No active plan or quota configured for your account.',
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
      allowed: used < effectiveLimit,
      used,
      limit: effectiveLimit,
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
