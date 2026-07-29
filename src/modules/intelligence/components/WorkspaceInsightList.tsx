import type { WorkspaceInsight } from '@/modules/intelligence/orchestrator/types'

/** UX-8 Phase 5/9 — deterministic cross-workspace facts, plain label/value rows. */
export function WorkspaceInsightList({ insights }: { insights: WorkspaceInsight[] }) {
  if (insights.length === 0) return null

  return (
    <ul className="flex flex-col gap-0.5 text-xs text-[var(--color-ink-muted)]">
      {insights.map((insight) => (
        <li key={insight.type}>
          <span className="font-medium text-[var(--color-ink)]">{insight.label}:</span> {insight.value}
        </li>
      ))}
    </ul>
  )
}
