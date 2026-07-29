import type { IntelligenceScore } from '@/modules/intelligence/dashboard/dashboardMetrics'
import { getHealthStatus } from '@/modules/ai/observability/healthScore'
import { SurfaceCard } from '@/shared/components/ui/surface/SurfaceCard'
import { StatusBadge } from '@/shared/components/ui/feedback/StatusBadge'

const STATUS_VARIANT = {
  excellent: 'success',
  healthy: 'success',
  degraded: 'warning',
  critical: 'error',
} as const

const TREND_LABEL = { up: '↑ Rising', down: '↓ Falling', stable: '→ Steady' } as const

/**
 * UX-11 Phase 2/7 — the Personal Intelligence Index. Reuses
 * getHealthStatus (its 0-100 excellent/healthy/degraded/critical mapping
 * is provider-agnostic per its own docstring) rather than inventing a
 * second score-tier scheme, and SurfaceCard/StatusBadge — no new design
 * language.
 */
export function IntelligenceScoreSection({ scores }: { scores: IntelligenceScore[] }) {
  if (scores.length === 0) return null
  const overall = Math.round(scores.reduce((sum, s) => sum + s.value, 0) / scores.length)

  return (
    <div className="flex flex-col gap-3">
      <SurfaceCard className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-[var(--color-ink-muted)]">Personal Intelligence Index</p>
          <p className="mt-1 text-3xl font-semibold text-[var(--color-ink)]">{overall}</p>
        </div>
        <StatusBadge label={getHealthStatus(overall)} variant={STATUS_VARIANT[getHealthStatus(overall)]} />
      </SurfaceCard>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {scores.map((score) => (
          <SurfaceCard key={score.category} padding="sm" className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-[var(--color-ink-muted)]">{score.label}</p>
              {score.trend && <span className="text-[11px] text-[var(--color-ink-muted)]">{TREND_LABEL[score.trend]}</span>}
            </div>
            <p className="text-xl font-semibold text-[var(--color-ink)]">{score.value}</p>
            <p className="text-[11px] text-[var(--color-ink-muted)]">{score.explanation}</p>
          </SurfaceCard>
        ))}
      </div>
    </div>
  )
}
