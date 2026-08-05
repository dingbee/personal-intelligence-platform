import { supabase } from '@/shared/lib/supabase'

export const quotaService = {
  async checkQuota(
    userId: string,
    quotaKey: string,
  ) {
    const { data: assignment, error: assignmentError } = await supabase
      .from('user_plan_assignments')
      .select('plan_id')
      .eq('user_id', userId)
      .eq('active', true)
      .single()

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
      .single()

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
      .single()

    const used = usage?.usage_count ?? 0

    return {
      allowed: used < quota.quota_limit,
      used,
      limit: quota.quota_limit,
    }
  },

  async consumeQuota(
  userId: string,
  quotaKey: string,
) {
  const { data: existing, error } = await supabase
    .from('quota_usage')
    .select('id, usage_count')
    .eq('user_id', userId)
    .eq('quota_key', quotaKey)
    .single()

  if (error && error.code !== 'PGRST116') {
    throw error
  }

  if (existing) {
    const { error: updateError } = await supabase
      .from('quota_usage')
      .update({
        usage_count: existing.usage_count + 1,
      })
      .eq('id', existing.id)

    if (updateError) throw updateError
  } else {
    const { error: insertError } = await supabase
      .from('quota_usage')
      .insert({
        user_id: userId,
        quota_key: quotaKey,
        usage_count: 1,
      })

    if (insertError) throw insertError
  }

  return true
},
}
