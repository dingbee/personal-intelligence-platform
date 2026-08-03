import { useWorkspaceRecommendations } from '@/modules/intelligence/recommendations/hooks/useWorkspaceRecommendations'
import { useCommandContext } from '@/modules/commands/hooks/useCommandContext'
import { useCommandActions } from '@/modules/commands/hooks/useCommandActions'
import { RecommendedActionsSection } from '@/modules/intelligence/dashboard/components/RecommendedActionsSection'

/**
 * UX-15.3 Phase 4 — the same `generateRecommendations`/`RecommendedActionsSection`
 * Hub and Dashboard already render, now reachable from Command Palette,
 * Export Center, and Knowledge Explorer via `useWorkspaceRecommendations`.
 * Unlike Hub/Dashboard (where an empty recommendation list is still worth
 * an explicit "no recommendations yet" message, since that's the page's
 * whole point), these are secondary surfaces — silently rendering nothing
 * is the right empty state here.
 */
export function SuggestedForYou({ limit = 3 }: { limit?: number }) {
  const recommendations = useWorkspaceRecommendations(limit)
  const commandContext = useCommandContext()
  const commandActions = useCommandActions()

  if (recommendations.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">Suggested for you</p>
      <RecommendedActionsSection recommendations={recommendations} commandContext={commandContext} commandActions={commandActions} />
    </div>
  )
}
