import type { ExecutiveInsight } from '@/modules/intelligence/dashboard/dashboardInsights'
import { SurfaceCard } from '@/shared/components/ui/surface/SurfaceCard'
import { EmptyState } from '@/shared/components/ui/EmptyState'

const CATEGORY_LABEL: Record<ExecutiveInsight['category'], string> = {
  knowledge: 'Knowledge',
  learning: 'Learning',
  organization: 'Organization',
  memory: 'Memory',
  research: 'Research',
}

/** UX-11 Phase 5 — every insight shows its evidence directly beneath the message, per the brief's "every insight requires evidence." Plain SurfaceCard list, no new primitives. */
export function ExecutiveInsightsSection({ insights }: { insights: ExecutiveInsight[] }) {
  if (insights.length === 0) {
    return <EmptyState title="Nothing to report yet" description="Insights appear here as you read, chat, and build your knowledge graph." />
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {insights.map((insight, index) => (
        <SurfaceCard key={`${insight.category}-${index}`} padding="sm" className="flex flex-col gap-1">
          <p className="text-xs font-medium text-[var(--color-ink-muted)]">{CATEGORY_LABEL[insight.category]}</p>
          <p className="text-sm text-[var(--color-ink)]">{insight.message}</p>
          <p className="text-[11px] text-[var(--color-ink-muted)]">{insight.evidence}</p>
        </SurfaceCard>
      ))}
    </div>
  )
}
