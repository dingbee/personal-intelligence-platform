import { getHealthStatus, type HealthStatus } from '@/modules/ai/observability/healthScore'

type BadgeKey = HealthStatus | 'offline'

const STATUS_STYLES: Record<BadgeKey, { label: string; className: string }> = {
  excellent: { label: 'Excellent', className: 'bg-green-100 text-green-700' },
  healthy: { label: 'Healthy', className: 'bg-green-100 text-green-700' },
  degraded: { label: 'Degraded', className: 'bg-amber-100 text-amber-700' },
  critical: { label: 'Critical', className: 'bg-red-100 text-red-700' },
  // Not one of getHealthStatus's four tiers — a UI-only label for an
  // unavailable provider (which always scores 0, i.e. 'critical' by the
  // numeric mapping, but "Offline" is a clearer reason for a user to see).
  offline: { label: 'Offline', className: 'bg-[var(--color-canvas)] text-[var(--color-ink-muted)]' },
}

export function HealthScoreBadge({ score, isAvailable }: { score: number; isAvailable: boolean }) {
  const key: BadgeKey = isAvailable ? getHealthStatus(score) : 'offline'
  const { label, className } = STATUS_STYLES[key]

  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-sm font-semibold tabular-nums text-[var(--color-ink)]">{score}</span>
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>{label}</span>
    </span>
  )
}
