import { Link } from 'react-router-dom'
import { HealthScoreBadge } from '@/modules/ai/observability/components/HealthScoreBadge'

/** A clickable provider row — score + status at a glance, drilling into ProviderHealthDetailPage for the full picture. */
export function ProviderHealthCard({
  providerId,
  label,
  healthScore,
  isAvailable,
  requestCount,
  successRate,
}: {
  providerId: string
  label: string
  healthScore: number
  isAvailable: boolean
  requestCount: number
  successRate: number | null
}) {
  return (
    <Link
      to={`/settings/ai-health/provider/${providerId}`}
      className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 shadow-soft transition-shadow hover:shadow-soft-lg"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-[var(--color-ink)]">{label}</p>
        <p className="text-xs text-[var(--color-ink-muted)]">
          {requestCount} request{requestCount === 1 ? '' : 's'}
          {successRate !== null && ` · ${Math.round(successRate * 100)}% success`}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <HealthScoreBadge score={healthScore} isAvailable={isAvailable} />
        <span aria-hidden className="text-[var(--color-ink-muted)]">
          ›
        </span>
      </div>
    </Link>
  )
}
