import type { DashboardRecommendation, RecommendationCategory } from '@/modules/intelligence/dashboard/dashboardRecommendations'
import type { CommandActions, CommandContext } from '@/modules/commands/types'
import { EmptyState } from '@/shared/components/ui/EmptyState'

const CATEGORY_ORDER: { category: RecommendationCategory; label: string }[] = [
  { category: 'explore', label: 'Explore' },
  { category: 'review', label: 'Review' },
  { category: 'continue', label: 'Continue' },
  { category: 'organize', label: 'Organize' },
]

/** UX-11 Phase 7 — every button here executes an existing registry command (command.execute), same pattern as GraphIntelligencePanel/ReaderIntelligencePanel's suggestion pills. No new action, no new design language. */
export function RecommendedActionsSection({
  recommendations,
  commandContext,
  commandActions,
}: {
  recommendations: DashboardRecommendation[]
  commandContext: CommandContext
  commandActions: CommandActions
}) {
  if (recommendations.length === 0) {
    return <EmptyState title="No recommendations yet" description="Keep using NOVA and recommendations will appear here." />
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {CATEGORY_ORDER.map(({ category, label }) => {
        const items = recommendations.filter((r) => r.category === category)
        if (items.length === 0) return null
        return (
          <div key={category} className="flex flex-col gap-2">
            <p className="text-xs font-medium text-[var(--color-ink-muted)]">{label}</p>
            <div className="flex flex-col gap-1.5">
              {items.map((item) => (
                <button
                  key={item.command.id}
                  type="button"
                  onClick={() => void item.command.execute(commandContext, commandActions)}
                  className="flex flex-col items-start gap-0.5 rounded-control border border-[var(--color-border)] bg-[var(--surface-raised)] px-3 py-2 text-left text-xs shadow-raised transition-shadow hover:shadow-floating"
                >
                  <span className="font-medium text-[var(--color-ink)]">
                    {item.command.icon} {item.command.title}
                  </span>
                  <span className="text-[var(--color-ink-muted)]">{item.reason}</span>
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
