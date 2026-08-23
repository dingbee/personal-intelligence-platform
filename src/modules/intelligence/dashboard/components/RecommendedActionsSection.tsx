import { useEffect } from 'react'
import type { Recommendation, RecommendationCategory } from '@/modules/intelligence/recommendations/recommendationEngine'
import type { CommandActions, CommandContext } from '@/modules/commands/types'
import { recommendationItemKey } from '@/modules/intelligence/dashboard/recommendationItemKey'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { persistProactiveRecommendations } from '@/modules/notifications/api/proactiveRecommendations'

const CATEGORY_ORDER: { category: RecommendationCategory; label: string }[] = [
  { category: 'explore', label: 'Explore' },
  { category: 'review', label: 'Review' },
  { category: 'continue', label: 'Continue' },
  { category: 'organize', label: 'Organize' },
]

export function RecommendedActionsSection({
  recommendations,
  commandContext,
  commandActions,
  dismissedKeys,
  onDismiss,
}: {
  recommendations: Recommendation[]
  commandContext: CommandContext
  commandActions: CommandActions
  dismissedKeys?: Set<string>
  onDismiss?: (itemKey: string) => void
}) {
  const visible = dismissedKeys ? recommendations.filter((r) => !dismissedKeys.has(recommendationItemKey(r))) : recommendations
  const recommendationKey = visible.map((recommendation) => `${recommendation.command.id}:${recommendation.reason}`).join('|')

  useEffect(() => {
    if (visible.length === 0) return
    void persistProactiveRecommendations(visible, commandContext.workspaceId ?? null).catch((error) => {
      // Delivery is additive; a notification failure must never break the
      // existing recommendation surface.
      console.error('persistProactiveRecommendations failed', error)
    })
  }, [commandContext.workspaceId, recommendationKey])

  if (visible.length === 0) {
    return <EmptyState title="No recommendations yet" description="Keep using ARRIYIA and recommendations will appear here." />
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {CATEGORY_ORDER.map(({ category, label }) => {
        const items = visible.filter((r) => r.category === category)
        if (items.length === 0) return null
        return (
          <div key={category} className="flex flex-col gap-2">
            <p className="text-xs font-medium text-[var(--color-ink-muted)]">{label}</p>
            <div className="flex flex-col gap-1.5">
              {items.map((item) => (
                <div key={item.command.id} className="group relative flex flex-col items-start gap-0.5 rounded-control border border-[var(--color-border)] bg-[var(--surface-raised)] px-3 py-2 text-left text-xs shadow-raised transition-shadow hover:shadow-floating">
                  <button type="button" onClick={() => void item.command.execute(commandContext, commandActions)} className="flex w-full flex-col items-start gap-0.5 pr-4 text-left">
                    <span className="font-medium text-[var(--color-ink)]">{item.command.icon} {item.command.title}</span>
                    <span className="text-[var(--color-ink-muted)]">{item.reason}</span>
                  </button>
                  {onDismiss && <button type="button" onClick={() => onDismiss(recommendationItemKey(item))} aria-label="Dismiss recommendation" className="absolute right-2 top-2 text-[var(--color-ink-muted)] opacity-0 transition-opacity hover:text-[var(--color-ink)] group-hover:opacity-100">✕</button>}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
