import type { WorkspaceIntelligenceSummary } from '@/modules/intelligence/dashboard/dashboardResolver'
import { SurfaceCard } from '@/shared/components/ui/surface/SurfaceCard'
import { StatCard } from '@/shared/components/ui/surface/StatCard'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { formatRelativeTime } from '@/shared/utils/formatRelativeTime'

/** UX-11 Phase 8 — one summary per workspace, reusing getWorkspaceStats + the graph's own edge count (dashboardResolver.ts). SurfaceCard/StatCard only, no new primitives. */
export function WorkspaceIntelligenceSection({ summaries }: { summaries: WorkspaceIntelligenceSummary[] }) {
  if (summaries.length === 0) {
    return <EmptyState title="No workspaces yet" description="Create a workspace to see its intelligence summary here." />
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {summaries.map((summary) => (
        <SurfaceCard key={summary.workspaceId} padding="sm" className="flex flex-col gap-3">
          <div>
            <p className="font-medium text-[var(--color-ink)]">{summary.workspaceName}</p>
            <p className="text-xs text-[var(--color-ink-muted)]">
              {summary.lastActivityAt ? `Last activity ${formatRelativeTime(summary.lastActivityAt)}` : 'No activity yet'}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <StatCard variant="inset" label="Documents" value={summary.documentCount} />
            <StatCard variant="inset" label="Concepts" value={summary.conceptCount} />
            <StatCard variant="inset" label="Connections" value={summary.connectionCount} />
          </div>
        </SurfaceCard>
      ))}
    </div>
  )
}
