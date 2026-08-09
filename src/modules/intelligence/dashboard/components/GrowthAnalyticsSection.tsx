import type { GrowthMetric } from '@/modules/intelligence/dashboard/dashboardMetrics'
import { SurfaceCard } from '@/shared/components/ui/surface/SurfaceCard'
import { EmptyState } from '@/shared/components/ui/EmptyState'

/** UX-11 Phase 3 — Knowledge Growth Analytics: 7-day / 30-day / all-time counts, one row per metric. Plain table, no new primitives. */
export function GrowthAnalyticsSection({ growth }: { growth: GrowthMetric[] }) {
  const hasAnyActivity = growth.some((metric) => metric.allTime > 0)
  if (!hasAnyActivity) {
    return <EmptyState title="No activity yet" description="Add documents, take notes, and chat with ARRIYIA to see growth here." />
  }

  return (
    <SurfaceCard padding="sm" className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-left text-xs">
        <thead>
          <tr className="text-[var(--color-ink-muted)]">
            <th className="py-1 font-medium">Metric</th>
            <th className="py-1 text-right font-medium">7 days</th>
            <th className="py-1 text-right font-medium">30 days</th>
            <th className="py-1 text-right font-medium">All time</th>
          </tr>
        </thead>
        <tbody>
          {growth.map((metric) => (
            <tr key={metric.type} className="border-t border-[var(--color-border)]">
              <td className="py-1.5 text-[var(--color-ink)]">{metric.label}</td>
              <td className="py-1.5 text-right tabular-nums text-[var(--color-ink)]">{metric.last7Days}</td>
              <td className="py-1.5 text-right tabular-nums text-[var(--color-ink)]">{metric.last30Days}</td>
              <td className="py-1.5 text-right tabular-nums text-[var(--color-ink)]">{metric.allTime}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </SurfaceCard>
  )
}
