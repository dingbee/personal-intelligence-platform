import type { EvolutionEvent } from '@/modules/evolution/knowledgeEvolution/knowledgeTimeline'
import { EmptyState } from '@/shared/components/ui/EmptyState'
import { formatRelativeTime } from '@/shared/utils/formatRelativeTime'

/** UX-13 Knowledge Timeline — most-recent-first, one line per event; buildKnowledgeTimeline already sorted and worded these, this just renders them. */
export function EvolutionTimelineSection({ events }: { events: EvolutionEvent[] }) {
  if (events.length === 0) {
    return <EmptyState title="No knowledge history yet" description="Add documents, notes, or concepts to start building a timeline." />
  }

  return (
    <ol className="flex flex-col gap-2">
      {events.map((event, index) => (
        <li key={`${event.type}-${event.date}-${index}`} className="flex items-baseline justify-between gap-4 text-sm">
          <span className="text-[var(--color-ink)]">{event.description}</span>
          <span className="shrink-0 text-xs text-[var(--color-ink-muted)]">{formatRelativeTime(event.date)}</span>
        </li>
      ))}
    </ol>
  )
}
