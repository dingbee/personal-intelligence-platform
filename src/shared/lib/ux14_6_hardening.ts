/** UX-14.6 production-hardening primitives. Pure helpers only. */
export function clampTouchTarget(size: number, minimum = 44): number {
  return Math.max(minimum, size)
}

export function getUsageState(used: number, limit: number): 'normal' | 'warning' | 'critical' | 'exhausted' {
  if (!Number.isFinite(limit) || limit <= 0) return 'exhausted'
  const ratio = Math.max(0, used) / limit
  if (ratio >= 1) return 'exhausted'
  if (ratio >= 0.9) return 'critical'
  if (ratio >= 0.75) return 'warning'
  return 'normal'
}

export function getUsageLabel(used: number, limit: number): string {
  const state = getUsageState(used, limit)
  if (state === 'exhausted') return 'Usage limit reached'
  if (state === 'critical') return 'Almost at your usage limit'
  if (state === 'warning') return 'Usage is getting high'
  return 'Usage available'
}

export function getNotificationLabel(type: string): string {
  const labels: Record<string, string> = {
    proactive_recommendation: 'ARRIYIA recommendation',
    quota_threshold: 'Usage update',
    founding_pro_expiry_warning: 'Founding Pro reminder',
    founding_pro_transition: 'Plan update',
  }
  return labels[type] ?? 'ARRIYIA notification'
}
