import type { WorkspaceHealthIndicator } from '@/modules/hub/workspaceHealth'
import { SurfaceCard } from '@/shared/components/ui/surface/SurfaceCard'

const STATUS_DOT_CLASS: Record<WorkspaceHealthIndicator['status'], string> = {
  good: 'bg-emerald-500',
  warning: 'bg-amber-500',
  unknown: 'bg-[var(--color-ink-muted)]',
}

/** UX-15.3 Phase 5 — one compact strip of passive health indicators, every value reused from WorkspaceHubState (see computeWorkspaceHealth's own doc-comment for what backs each one, and which one (export/backup status) has no signal at all). */
export function WorkspaceHealthPanel({ indicators }: { indicators: WorkspaceHealthIndicator[] }) {
  return (
    <SurfaceCard className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
      {indicators.map((indicator) => (
        <div key={indicator.id} className="flex flex-col gap-1" title={indicator.description}>
          <div className="flex items-center gap-1.5">
            <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT_CLASS[indicator.status]}`} />
            <span className="text-xs text-[var(--color-ink-muted)]">{indicator.label}</span>
          </div>
          <span className="text-sm font-medium text-[var(--color-ink)]">{indicator.value}</span>
        </div>
      ))}
    </SurfaceCard>
  )
}
