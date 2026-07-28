import { Link } from 'react-router-dom'
import { useRecentHighlights } from '@/modules/knowledge/hooks/useDashboardData'
import { DashboardSection } from '@/modules/knowledge/components/DashboardSection'

export function RecentHighlightsSection() {
  const { data: highlights = [], isLoading } = useRecentHighlights(5)

  return (
    <DashboardSection
      title="Recent highlights"
      isLoading={isLoading}
      isEmpty={highlights.length === 0}
      emptyMessage="No highlights yet — select text while reading a document to highlight it."
    >
      <ul className="flex flex-col gap-3">
        {highlights.map((highlight) => (
          <li key={highlight.id} className="rounded-lg border-l-2 border-[var(--color-accent)] bg-[var(--color-canvas)] p-3">
            <p className="text-sm italic text-[var(--color-ink)]">“{highlight.quote}”</p>
            <div className="mt-1.5 flex items-center justify-between text-xs text-[var(--color-ink-muted)]">
              <span className="truncate">
                {highlight.document?.title ?? 'Unknown document'}
                {highlight.chapter_index !== null && ` · Chapter ${highlight.chapter_index + 1}`}
              </span>
              <Link to={`/library/${highlight.document_id}/read`} className="shrink-0 text-[var(--color-accent)] hover:underline">
                Open in reader →
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </DashboardSection>
  )
}
