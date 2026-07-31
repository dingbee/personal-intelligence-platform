import type { KnowledgeGap } from '@/modules/evolution/knowledgeGaps/knowledgeGaps'
import { EmptyState } from '@/shared/components/ui/EmptyState'

/** UX-13.7 — computeKnowledgeGaps's output, one line per gap; same list styling as KnowledgeHealthSection's issue list since these are drawn from the same underlying data. */
export function WorkspaceGapsSection({ gaps }: { gaps: KnowledgeGap[] }) {
  if (gaps.length === 0) {
    return <EmptyState title="No gaps detected" description="Nothing looks orphaned, stale, or neglected right now." />
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {gaps.map((gap, index) => (
        <li key={`${gap.type}-${index}`} className="text-sm text-[var(--color-ink-muted)]">
          {gap.message}
        </li>
      ))}
    </ul>
  )
}
