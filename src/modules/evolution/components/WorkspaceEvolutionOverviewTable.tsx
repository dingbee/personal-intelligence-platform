import type { WorkspaceEvolutionOverviewEntry } from '@/modules/evolution/evolutionOverview'
import { MaturityBadge } from '@/modules/evolution/components/MaturityBadge'
import { EmptyState } from '@/shared/components/ui/EmptyState'

/** UX-13 — "All Workspaces" mode: one row per workspace with its maturity and health score, mirroring WorkspaceIntelligenceSection's per-workspace summary table. Switch to a specific workspace (WorkspaceSwitcher) to see its full evolution report. */
export function WorkspaceEvolutionOverviewTable({ entries }: { entries: WorkspaceEvolutionOverviewEntry[] }) {
  if (entries.length === 0) {
    return <EmptyState title="No workspaces yet" description="Create a workspace to start tracking its evolution." />
  }

  return (
    <ul className="flex flex-col gap-2">
      {entries.map((entry) => (
        <li key={entry.workspaceId} className="flex items-center justify-between gap-4 rounded-control bg-[var(--surface-inset)] px-3 py-2 text-sm">
          <span className="text-[var(--color-ink)]">{entry.workspaceName}</span>
          <div className="flex shrink-0 items-center gap-3 text-xs text-[var(--color-ink-muted)]">
            <span>Health: {entry.healthScore}</span>
            <MaturityBadge stage={entry.maturityStage} label={entry.maturityLabel} />
          </div>
        </li>
      ))}
    </ul>
  )
}
